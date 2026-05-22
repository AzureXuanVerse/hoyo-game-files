<script setup lang="ts">
import type { ChunkManifest } from '@/types'
import { API_BASE } from '@/constants/core'
import { fetchAndParseManifest } from '@/utils/manifest'
import { getUsmStreamDecryptor } from '@/utils/usm'

interface Props {
  filename: string
  keyHex: string
  directDownloadUrl: string | null
  bestChunkVersion: string | null
  gameId: string
  filePath: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const videoRef = ref<HTMLVideoElement | null>(null)
const phase = ref<'init' | 'buffering' | 'playing' | 'error'>('init')
const errorMsg = ref('')
const progress = ref(0)
const showHelp = ref(false)
const progressLabel = ref('')

let abortController: AbortController | null = null
let mediaSource: MediaSource | null = null
let objectUrl: string | null = null

const mimeType = 'video/webm; codecs="vp9"'

function makeSourceBufferQueue(sb: SourceBuffer) {
  const queue: Uint8Array[] = []
  let busy = false

  function drain() {
    if (busy || !queue.length || sb.updating)
      return
    busy = true
    try {
      sb.appendBuffer(queue.shift() as any)
    }
    catch {
      busy = false
    }
  }

  sb.addEventListener('updateend', () => {
    busy = false
    drain()
  })

  return {
    append(data: Uint8Array) {
      queue.push(data.slice())
      drain()
    },
    waitDrained(): Promise<void> {
      return new Promise((resolve) => {
        const check = () => {
          if (!busy && queue.length === 0)
            resolve()
          else
            setTimeout(check, 30)
        }
        check()
      })
    },
  }
}

async function startStreaming() {
  if (!videoRef.value)
    return

  if (!MediaSource.isTypeSupported(mimeType)) {
    phase.value = 'error'
    errorMsg.value = '当前浏览器不支持 WebM VP9 流式播放（建议使用 Chrome/Edge）'
    return
  }

  abortController = new AbortController()
  const { signal } = abortController

  mediaSource = new MediaSource()
  objectUrl = URL.createObjectURL(mediaSource)
  videoRef.value.src = objectUrl

  await new Promise<void>((resolve, reject) => {
    mediaSource!.addEventListener('sourceopen', () => resolve(), { once: true })
    mediaSource!.addEventListener('error', () => reject(new Error('MediaSource error')), { once: true })
  })

  const sb = mediaSource.addSourceBuffer(mimeType)
  const sbQueue = makeSourceBufferQueue(sb)

  phase.value = 'buffering'
  progress.value = 0

  try {
    const dec = await getUsmStreamDecryptor(props.keyHex)

    if (props.directDownloadUrl) {
      await streamDirect(props.directDownloadUrl, dec, sbQueue, signal)
    }
    else if (props.bestChunkVersion) {
      await streamChunks(props.bestChunkVersion, dec, sbQueue, signal)
    }
    else {
      throw new Error('无可用资源')
    }

    if (signal.aborted)
      return

    const finalResult = dec.finish()
    for (const c of finalResult.clusters as Uint8Array[])
      sbQueue.append(c)

    dec.free()

    await sbQueue.waitDrained()

    if (!signal.aborted && mediaSource.readyState === 'open') {
      mediaSource.endOfStream()
    }

    progress.value = 100
    progressLabel.value = '加载完成'
    phase.value = 'playing'
  }
  catch (e) {
    if ((e as Error).name === 'AbortError')
      return
    phase.value = 'error'
    errorMsg.value = (e as Error).message || String(e)
  }
}

async function streamDirect(
  url: string,
  dec: Awaited<ReturnType<typeof getUsmStreamDecryptor>>,
  sbQueue: ReturnType<typeof makeSourceBufferQueue>,
  signal: AbortSignal,
) {
  const res = await fetch(url, { signal })
  if (!res.ok)
    throw new Error(`HTTP ${res.status}`)

  const total = Number(res.headers.get('Content-Length') ?? 0)
  let received = 0
  const reader = res.body!.getReader()

  for (;;) {
    const { done, value } = await reader.read()
    if (done)
      break
    if (signal.aborted)
      return

    received += value.byteLength
    if (total > 0) {
      progress.value = Math.min(99, Math.round((received / total) * 99))
      progressLabel.value = `${formatBytes(received)} / ${formatBytes(total)}`
    }
    else {
      progressLabel.value = `已接收 ${formatBytes(received)}`
    }

    const result = dec.push(value)
    if (result.init_segment)
      sbQueue.append(result.init_segment as Uint8Array)
    for (const c of result.clusters as Uint8Array[])
      sbQueue.append(c)
  }
}

async function streamChunks(
  chunkVersion: string,
  dec: Awaited<ReturnType<typeof getUsmStreamDecryptor>>,
  sbQueue: ReturnType<typeof makeSourceBufferQueue>,
  signal: AbortSignal,
) {
  const res = await fetch(`${API_BASE}/chunk/${props.gameId}_${chunkVersion}.json`, { signal })
  if (!res.ok)
    throw new Error(`Chunk 列表获取失败：HTTP ${res.status}`)
  const json = await res.json()
  const manifests: ChunkManifest[] = json.data?.manifests ?? []

  let chunkUrlPrefix = ''
  let foundFile: { chunks: Array<{ id: string, offset: number, uncompressedSize: number }> } | null = null

  for (const m of manifests) {
    if (signal.aborted)
      return
    const cacheKey = `${props.gameId}_${chunkVersion}_${m.manifest.id}`
    const url = `${m.manifest_download.url_prefix}/${m.manifest.id}`
    let parsed
    try {
      parsed = await fetchAndParseManifest(url, cacheKey, Number(m.manifest.uncompressed_size), signal)
    }
    catch (e) {
      if ((e as Error).name === 'AbortError' || e instanceof TypeError)
        throw e
      continue
    }
    const match = parsed.files.find(f => f.path === props.filePath)
    if (match) {
      foundFile = match
      chunkUrlPrefix = m.chunk_download.url_prefix
      break
    }
  }

  if (!foundFile)
    throw new Error('无可用资源')

  const chunks = [...foundFile.chunks].sort((a, b) => a.offset - b.offset)
  const total = chunks.length
  const { ZSTDDecoder } = await import('zstddec')
  const zstd = new ZSTDDecoder()
  await zstd.init()

  for (let i = 0; i < total; i++) {
    if (signal.aborted)
      return

    const chunk = chunks[i]
    const chunkRes = await fetch(`${chunkUrlPrefix}/${chunk.id}`, { signal })
    if (!chunkRes.ok)
      throw new Error(`Chunk 下载失败：HTTP ${chunkRes.status}`)

    const compressed = new Uint8Array(await chunkRes.arrayBuffer())
    const decompressed = zstd.decode(compressed, chunk.uncompressedSize)

    const result = dec.push(decompressed)
    if (result.init_segment)
      sbQueue.append(result.init_segment as Uint8Array)
    for (const c of result.clusters as Uint8Array[])
      sbQueue.append(c)

    progress.value = Math.min(99, Math.round(((i + 1) / total) * 99))
    progressLabel.value = `Chunk ${i + 1} / ${total}`
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3)
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2)
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024)
    return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function handleClose() {
  abortController?.abort()
  if (mediaSource && mediaSource.readyState === 'open') {
    try {
      mediaSource.endOfStream()
    }
    catch {}
  }
  if (objectUrl)
    URL.revokeObjectURL(objectUrl)
  emit('close')
}

onMounted(() => startStreaming())
onUnmounted(() => {
  abortController?.abort()
  if (objectUrl)
    URL.revokeObjectURL(objectUrl)
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70" @click="handleClose" />
      <div class="relative flex w-full max-w-3xl flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div class="flex items-center gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <LucideFileVideo class="h-4 w-4 shrink-0 text-blue-500" />
          <span class="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{{ filename }}</span>
          <button
            class="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            @click="handleClose"
          >
            <LucideX class="h-4 w-4" />
          </button>
        </div>

        <div class="p-4">
          <div
            v-if="phase === 'error'"
            class="flex flex-col items-center gap-2 py-12 text-red-500"
          >
            <LucideAlertCircle class="h-8 w-8" />
            <p class="text-sm">
              {{ errorMsg }}
            </p>
            <button
              class="mt-2 text-xs text-blue-500 hover:text-blue-600"
              @click="showHelp = true"
            >
              出现 Failed to fetch？点击查看帮助
            </button>
          </div>

          <template v-else>
            <div class="relative overflow-hidden rounded-lg bg-black">
              <video
                ref="videoRef"
                controls
                autoplay
                class="max-h-[60vh] w-full"
              />
              <div
                v-if="phase === 'init' || (phase === 'buffering' && progress === 0)"
                class="absolute inset-0 flex items-center justify-center bg-black/60"
              >
                <LucideLoader2 class="h-8 w-8 animate-spin text-white" />
              </div>
            </div>

            <div class="mt-3 space-y-1.5">
              <div class="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  class="h-full rounded-full bg-blue-500 transition-all duration-300"
                  :style="{ width: `${progress}%` }"
                />
              </div>
              <div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>{{ progressLabel || '正在初始化...' }}</span>
                <span>{{ progress }}%</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>

  <HelpModal v-if="showHelp" @close="showHelp = false" />
</template>
