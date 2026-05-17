import type { ChunkManifest, DownloadStatus, DownloadTask, GameFileRecord, ParsedFile } from '@/types'
import { defineStore } from 'pinia'
import { fetchAndParseManifest } from '@/utils/manifest'

const MAX_CONCURRENT = 3

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function triggerDownload(filename: string, data: Uint8Array | string, mimeType: string) {
  const blobPart = typeof data === 'string' ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const blob = new Blob([blobPart], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export const useDownloadStore = defineStore('downloads', () => {
  const tasks = ref<DownloadTask[]>([])
  const isListOpen = ref(false)
  const controllers = new Map<string, AbortController>()

  const downloadingCount = computed(
    () => tasks.value.filter(t => t.status === 'downloading').length,
  )

  const activeCount = computed(
    () => tasks.value.filter(t => t.status === 'pending' || t.status === 'downloading' || t.status === 'decompressing' || t.status === 'merging').length,
  )

  function openList() {
    isListOpen.value = true
  }
  function closeList() {
    isListOpen.value = false
  }
  function toggleList() {
    isListOpen.value = !isListOpen.value
  }

  function clearCompleted() {
    tasks.value = tasks.value.filter(
      t => t.status !== 'success' && t.status !== 'failed' && t.status !== 'cancelled',
    )
  }

  function setTaskStatus(id: string, status: DownloadStatus, error?: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task)
      return
    task.status = status
    if (error !== undefined)
      task.error = error
  }

  function setTaskProgress(id: string, progress: number) {
    const task = tasks.value.find(t => t.id === id)
    if (task)
      task.progress = progress
  }

  function cancelTask(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (!task)
      return
    if (task.status === 'pending') {
      task.status = 'cancelled'
      return
    }
    if (task.status === 'downloading') {
      controllers.get(id)?.abort()
      controllers.delete(id)
      task.status = 'cancelled'
      processQueue()
    }
  }

  function processQueue() {
    while (downloadingCount.value < MAX_CONCURRENT) {
      const pending = [...tasks.value].reverse().find(t => t.status === 'pending')
      if (!pending)
        break

      pending.status = 'downloading'
      executeTask(pending)
    }
  }

  async function executeTask(task: DownloadTask) {
    try {
      if (task.type === 'manifest-json') {
        await runManifestJsonTask(task)
      }
      else {
        await runChunkFileTask(task)
      }
    }
    catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setTaskStatus(task.id, 'failed', (e as Error).message)
      }
    }
    finally {
      controllers.delete(task.id)
      processQueue()
    }
  }

  const manifestTaskData = new Map<string, {
    manifest: ChunkManifest
    gameId: string
    version: string
  }>()

  const chunkTaskData = new Map<string, {
    file: GameFileRecord
    manifests: ChunkManifest[]
    gameId: string
    version: string
  }>()

  async function runManifestJsonTask(task: DownloadTask) {
    const data = manifestTaskData.get(task.id)
    if (!data)
      throw new Error('任务数据丢失')

    const { manifest, gameId, version } = data
    const url = `${manifest.manifest_download.url_prefix}/${manifest.manifest.id}`
    const cacheKey = `${gameId}_${version}_${manifest.manifest.id}`
    const uncompressedSize = Number(manifest.manifest.uncompressed_size)

    const controller = new AbortController()
    controllers.set(task.id, controller)

    if (tasks.value.find(t => t.id === task.id)?.status === 'cancelled')
      return

    setTaskStatus(task.id, 'decompressing')

    const parsed = await fetchAndParseManifest(url, cacheKey, uncompressedSize, controller.signal)

    if (tasks.value.find(t => t.id === task.id)?.status === 'cancelled')
      return

    const json = JSON.stringify(parsed, null, 2)
    triggerDownload(`${manifest.manifest.id}.json`, json, 'application/json')

    setTaskStatus(task.id, 'success')
    setTaskProgress(task.id, 100)
    manifestTaskData.delete(task.id)
  }

  async function runChunkFileTask(task: DownloadTask) {
    const data = chunkTaskData.get(task.id)
    if (!data)
      throw new Error('任务数据丢失')

    const { file, manifests, gameId, version } = data
    const controller = new AbortController()
    controllers.set(task.id, controller)

    if (tasks.value.find(t => t.id === task.id)?.status === 'cancelled')
      return

    let foundFile: ParsedFile | null = null
    let chunkUrlPrefix = ''

    for (const m of manifests) {
      const cacheKey = `${gameId}_${version}_${m.manifest.id}`
      const url = `${m.manifest_download.url_prefix}/${m.manifest.id}`
      const uncompressedSize = Number(m.manifest.uncompressed_size)

      let parsed
      try {
        parsed = await fetchAndParseManifest(url, cacheKey, uncompressedSize, controller.signal)
      }
      catch (e) {
        if ((e as Error).name === 'AbortError')
          throw e
        continue
      }

      const match = parsed.files.find(f => f.path === file.remoteName)
      if (match) {
        foundFile = match
        chunkUrlPrefix = m.chunk_download.url_prefix
        break
      }

      if (tasks.value.find(t => t.id === task.id)?.status === 'cancelled')
        return
    }

    if (!foundFile) {
      chunkTaskData.delete(task.id)
      throw new Error('无匹配资源')
    }

    if (tasks.value.find(t => t.id === task.id)?.status === 'cancelled')
      return

    const chunks = [...foundFile.chunks].sort((a, b) => a.offset - b.offset)
    const totalChunks = chunks.length
    const buffers: Uint8Array[] = []

    setTaskStatus(task.id, 'downloading')
    setTaskProgress(task.id, 0)

    const { ZSTDDecoder } = await import('zstddec')
    const dec = new ZSTDDecoder()
    await dec.init()

    for (let i = 0; i < totalChunks; i++) {
      if (tasks.value.find(t => t.id === task.id)?.status === 'cancelled')
        return

      const chunk = chunks[i]
      const chunkUrl = `${chunkUrlPrefix}/${chunk.id}`
      const res = await fetch(chunkUrl, { signal: controller.signal })
      if (!res.ok)
        throw new Error(`Chunk 下载失败：${res.status}`)

      const compressed = new Uint8Array(await res.arrayBuffer())
      setTaskStatus(task.id, 'decompressing')
      const decompressed = dec.decode(compressed, chunk.uncompressedSize)
      buffers.push(decompressed)

      setTaskStatus(task.id, 'downloading')
      setTaskProgress(task.id, Math.round(((i + 1) / totalChunks) * 90))
    }

    setTaskStatus(task.id, 'merging')

    const totalSize = buffers.reduce((s, b) => s + b.length, 0)
    const merged = new Uint8Array(totalSize)
    let offset = 0
    for (const buf of buffers) {
      merged.set(buf, offset)
      offset += buf.length
    }

    const filename = file.remoteName.slice(file.remoteName.lastIndexOf('/') + 1)
    triggerDownload(filename, merged, 'application/octet-stream')

    setTaskStatus(task.id, 'success')
    setTaskProgress(task.id, 100)
    chunkTaskData.delete(task.id)
  }

  function addManifestJsonTask(manifest: ChunkManifest, gameId: string, version: string) {
    const id = makeId()
    const task: DownloadTask = {
      id,
      type: 'manifest-json',
      status: 'pending',
      name: `Manifest JSON — ${manifest.category_name}`,
      progress: 0,
    }
    manifestTaskData.set(id, { manifest, gameId, version })
    tasks.value.unshift(task)
    processQueue()
  }

  function addChunkFileTask(file: GameFileRecord, manifests: ChunkManifest[], gameId: string, version: string) {
    const id = makeId()
    const filename = file.remoteName.slice(file.remoteName.lastIndexOf('/') + 1)
    const task: DownloadTask = {
      id,
      type: 'chunk-file',
      status: 'pending',
      name: filename,
      progress: 0,
    }
    chunkTaskData.set(id, { file, manifests, gameId, version })
    tasks.value.unshift(task)
    processQueue()
  }

  return {
    tasks,
    isListOpen,
    downloadingCount,
    activeCount,
    openList,
    closeList,
    toggleList,
    clearCompleted,
    cancelTask,
    addManifestJsonTask,
    addChunkFileTask,
  }
})
