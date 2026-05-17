<script setup lang="ts">
import type { GameFileRecord } from '@/types'
import { AUDIO_LANG_LABELS } from '@/constants/core'
import { formatBytes } from '@/utils/file'

interface Props {
  mainFileList: GameFileRecord[]
  audioFileLists: Map<string, GameFileRecord[]>
  activeAudioLangs: Set<string>
  loadingAudioLangs: Set<string>
  isLoading: boolean
  error: string | null
  supportsAudio: boolean
  decompressedPath?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  load: []
  toggleAudio: [lang: string]
}>()

const currentPath = ref<string[]>([])
const searchQuery = ref('')
const selectedFile = ref<GameFileRecord | null>(null)

watch(() => props.mainFileList, (newList) => {
  if (newList.length === 0) {
    currentPath.value = []
    searchQuery.value = ''
    selectedFile.value = null
  }
})

const mergedFileList = computed<GameFileRecord[]>(() => {
  const result = [...props.mainFileList]
  for (const lang of props.activeAudioLangs) {
    const list = props.audioFileLists.get(lang)
    if (list)
      result.push(...list)
  }
  return result
})

const fileStats = computed(() => {
  if (!mergedFileList.value.length)
    return null
  const count = mergedFileList.value.length
  const totalSize = mergedFileList.value.reduce((s, f) => s + f.fileSize, 0)
  return { count, totalSize }
})

function enterFolder(name: string) {
  currentPath.value = [...currentPath.value, name]
  selectedFile.value = null
}

function navigateTo(index: number) {
  currentPath.value = currentPath.value.slice(0, index)
  selectedFile.value = null
}

function selectFile(file: GameFileRecord) {
  selectedFile.value = selectedFile.value?.remoteName === file.remoteName ? null : file
}

interface FolderStats {
  directObjectCount: number
  totalSize: number
}

const currentDirItems = computed(() => {
  const prefix = currentPath.value.length ? `${currentPath.value.join('/')}/` : ''
  const folderStats = new Map<string, FolderStats>()
  const seenSubfolders = new Map<string, Set<string>>()
  const files: GameFileRecord[] = []

  for (const file of mergedFileList.value) {
    if (!file.remoteName.startsWith(prefix))
      continue
    const rest = file.remoteName.slice(prefix.length)
    const slashIdx = rest.indexOf('/')
    if (slashIdx === -1) {
      files.push(file)
    }
    else {
      const folderName = rest.slice(0, slashIdx)
      const stats = folderStats.get(folderName) ?? { directObjectCount: 0, totalSize: 0 }
      const afterFolder = rest.slice(slashIdx + 1)
      if (!afterFolder.includes('/')) {
        stats.directObjectCount++
      }
      else {
        const subfolderName = afterFolder.slice(0, afterFolder.indexOf('/'))
        const seen = seenSubfolders.get(folderName) ?? new Set<string>()
        if (!seen.has(subfolderName)) {
          seen.add(subfolderName)
          stats.directObjectCount++
          seenSubfolders.set(folderName, seen)
        }
      }
      stats.totalSize += file.fileSize
      folderStats.set(folderName, stats)
    }
  }

  return {
    folders: [...folderStats.keys()].sort((a, b) => a.localeCompare(b)),
    folderStats,
    files: files.sort((a, b) => a.remoteName.localeCompare(b.remoteName)),
  }
})

const searchResults = computed<GameFileRecord[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q)
    return []
  return mergedFileList.value.filter(f => f.remoteName.toLowerCase().includes(q))
})

const fileDownloadUrl = computed(() => {
  const base = props.decompressedPath
  if (!base || !selectedFile.value)
    return null
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${selectedFile.value.remoteName}`
})
</script>

<template>
  <div class="flex min-h-0 flex-1 overflow-hidden">
    <div class="flex min-w-0 flex-1 flex-col border-r border-gray-200 dark:border-gray-700">
      <div class="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50">
        <div class="relative flex-1">
          <LucideSearch class="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索文件"
            class="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-7 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
          >
        </div>
        <template v-if="supportsAudio">
          <div class="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <button
            v-for="(label, lang) in AUDIO_LANG_LABELS"
            :key="lang"
            class="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors focus:outline-none"
            :class="activeAudioLangs.has(lang)
              ? 'border-blue-400 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
            :disabled="loadingAudioLangs.has(lang)"
            @click="emit('toggleAudio', lang)"
          >
            <LucideLoader2 v-if="loadingAudioLangs.has(lang)" class="h-3 w-3 animate-spin" />
            <LucideMusic v-else class="h-3 w-3" />
            {{ label }}
          </button>
        </template>
      </div>
      <div v-if="fileStats" class="flex shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-3 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900/50">
        <div class="flex items-center gap-1.5">
          <LucideFiles class="h-3.5 w-3.5 text-blue-500" />
          <span class="text-gray-500 dark:text-gray-400">文件总数</span>
          <span class="font-semibold text-gray-800 dark:text-gray-100">{{ fileStats.count.toLocaleString() }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <LucideHardDrive class="h-3.5 w-3.5 text-green-500" />
          <span class="text-gray-500 dark:text-gray-400">总大小</span>
          <span class="font-semibold text-gray-800 dark:text-gray-100">{{ formatBytes(fileStats.totalSize) }}</span>
        </div>
        <div class="hidden sm:block">
          点击文件可查看详情信息
        </div>
      </div>

      <div
        v-if="isLoading"
        class="flex flex-1 items-center justify-center text-gray-400 dark:text-gray-500"
      >
        <LucideLoader2 class="mr-2 h-5 w-5 animate-spin" />
        <span>加载文件列表...</span>
      </div>

      <div
        v-else-if="error"
        class="flex flex-1 flex-col items-center justify-center gap-2 text-red-500"
      >
        <LucideAlertCircle class="h-6 w-6" />
        <span class="text-sm">文件列表加载失败</span>
        <button
          class="rounded-md border border-red-300 px-3 py-1 text-xs hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
          @click="emit('load')"
        >
          重试
        </button>
      </div>

      <template v-else-if="mergedFileList.length">
        <template v-if="searchQuery.trim()">
          <div class="shrink-0 border-b border-gray-200 px-3 py-1.5 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
            找到 {{ searchResults.length.toLocaleString() }} 个文件
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto">
            <div
              v-for="file in searchResults"
              :key="file.remoteName"
              class="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
              :class="selectedFile?.remoteName === file.remoteName ? 'bg-blue-50 dark:bg-blue-900/20' : ''"
              @click="selectFile(file)"
            >
              <LucideFile class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="min-w-0 break-all text-xs text-gray-600 dark:text-gray-300">{{ file.remoteName }}</span>
              <span class="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500">{{ formatBytes(file.fileSize) }}</span>
            </div>
            <div v-if="searchResults.length === 0" class="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              无匹配文件
            </div>
          </div>
        </template>

        <template v-else>
          <div class="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-gray-200 px-3 py-1.5 dark:border-gray-700">
            <button
              class="shrink-0 text-xs text-blue-500 hover:underline focus:outline-none dark:text-blue-400"
              @click="navigateTo(0)"
            >
              根目录
            </button>
            <template v-for="(seg, i) in currentPath" :key="i">
              <LucideChevronRight class="h-3 w-3 shrink-0 text-gray-400" />
              <button
                class="shrink-0 text-xs text-blue-500 hover:underline focus:outline-none dark:text-blue-400"
                :class="i === currentPath.length - 1 ? 'pointer-events-none text-gray-600 dark:text-gray-300' : ''"
                @click="navigateTo(i + 1)"
              >
                {{ seg }}
              </button>
            </template>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto">
            <div
              v-for="folder in currentDirItems.folders"
              :key="`dir-${folder}`"
              class="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
              @click="enterFolder(folder)"
            >
              <LucideFolder class="h-4 w-4 shrink-0 text-yellow-400" />
              <span class="text-sm text-gray-700 dark:text-gray-200">{{ folder }}（{{ currentDirItems.folderStats.get(folder)?.directObjectCount }}）</span>
              <span class="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500">
                {{ formatBytes(currentDirItems.folderStats.get(folder)?.totalSize ?? 0) }}
              </span>
            </div>
            <div
              v-for="file in currentDirItems.files"
              :key="`file-${file.remoteName}`"
              class="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-2 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60"
              :class="selectedFile?.remoteName === file.remoteName ? 'bg-blue-50 dark:bg-blue-900/20' : ''"
              @click="selectFile(file)"
            >
              <LucideFile class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="min-w-0 truncate text-sm text-gray-700 dark:text-gray-200">{{ file.remoteName.slice(file.remoteName.lastIndexOf('/') + 1) }}</span>
              <span class="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500">{{ formatBytes(file.fileSize) }}</span>
            </div>
            <div
              v-if="currentDirItems.folders.length === 0 && currentDirItems.files.length === 0"
              class="py-8 text-center text-sm text-gray-400 dark:text-gray-500"
            >
              此目录为空
            </div>
          </div>
        </template>
      </template>

      <div
        v-else
        class="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400 dark:text-gray-500"
      >
        <LucideFiles class="h-8 w-8" />
        <p class="text-sm">
          尚未加载文件列表
        </p>
        <button
          class="flex items-center gap-1.5 rounded-lg bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 focus:outline-none dark:bg-blue-600 dark:hover:bg-blue-700"
          @click="emit('load')"
        >
          <LucideDownload class="h-4 w-4" />
          加载文件列表
        </button>
      </div>
    </div>

    <div
      v-if="selectedFile"
      class="fixed inset-0 z-50 flex flex-col border-l border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 md:relative md:inset-auto md:z-auto md:w-72 md:shrink-0 md:dark:bg-gray-800/30"
    >
      <div class="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <span class="text-xs font-medium text-gray-600 dark:text-gray-300">文件详情</span>
        <button
          class="rounded p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none dark:hover:text-gray-200"
          @click="selectedFile = null"
        >
          <LucideX class="h-4 w-4" />
        </button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto p-3">
        <div class="space-y-3">
          <div>
            <p class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              文件路径
            </p>
            <p class="break-all text-xs text-gray-700 dark:text-gray-200">
              {{ selectedFile.remoteName }}
            </p>
          </div>
          <div>
            <p class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              大小
            </p>
            <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {{ formatBytes(selectedFile.fileSize) }}
            </p>
            <p class="text-xs text-gray-400 dark:text-gray-500">
              {{ selectedFile.fileSize.toLocaleString() }} 字节
            </p>
          </div>
          <div>
            <p class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              MD5
            </p>
            <p class="break-all font-mono text-xs text-gray-700 dark:text-gray-200">
              {{ selectedFile.md5 }}
            </p>
          </div>
          <div v-if="selectedFile.hash">
            <p class="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              xxHash64
            </p>
            <p class="break-all font-mono text-xs text-gray-700 dark:text-gray-200">
              {{ selectedFile.hash }}
            </p>
          </div>
          <div v-if="fileDownloadUrl">
            <a
              :href="fileDownloadUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center justify-center gap-1.5 rounded-md bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600 focus:outline-none dark:bg-green-600 dark:hover:bg-green-700"
              :download="selectedFile.remoteName.slice(selectedFile.remoteName.lastIndexOf('/') + 1)"
            >
              <LucideDownload class="h-3.5 w-3.5" />
              直链下载
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
