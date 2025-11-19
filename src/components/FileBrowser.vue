<script setup lang="ts">
import type { FileNode } from '@/types'
import { NodeType } from '@/types'
import { copyToClipboard, formatBytes, openLink } from '@/utils'

const props = defineProps<{
  decompressedPath: string | null
  fileTree: FileNode | null
}>()

const displayFileNode = ref<FileNode | null>()
const currentPath = ref('')
// 视图模式：表格或平铺
const viewMode = ref<'table' | 'grid'>('table')
// 搜索关键字（全局匹配）
const searchQuery = ref('')

const isRootPath = computed(() => currentPath.value === '')
const breadcrumbItems = computed(() => {
  const res = currentPath.value.split('/')
  if (res.length === 1 && res[0] === '')
    return []
  return res
})

// 是否处于搜索状态
const isSearching = computed(() => searchQuery.value.trim().length > 0)

// 展平文件树，生成包含路径的信息，用于搜索
interface SearchItem {
  node: FileNode
  path: string
}

function flattenTree(root: FileNode | null): SearchItem[] {
  const results: SearchItem[] = []
  if (!root)
    return results
  const stack: { node: FileNode, path: string }[] = [{ node: root, path: '' }]
  while (stack.length) {
    const { node, path } = stack.pop()!
    if (node.type === NodeType.File) {
      results.push({ node, path })
    }
    else {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i]
        stack.push({ node: child, path: path ? `${path}/${node.name}` : node.name })
      }
    }
  }
  return results
}

// 根据搜索关键字过滤结果（大小写不敏感）
const searchResults = computed(() => {
  if (!isSearching.value)
    return [] as SearchItem[]
  const keyword = searchQuery.value.trim().toLowerCase()
  return flattenTree(props.fileTree).filter(({ node, path }) => {
    const nameMatch = node.name.toLowerCase().includes(keyword)
    const pathMatch = path.toLowerCase().includes(keyword)
    const remoteNameMatch = node.fileData?.remoteName?.toLowerCase().includes(keyword)
    return nameMatch || pathMatch || !!remoteNameMatch
  })
})

function updateDisplayFiles() {
  if (isRootPath.value) {
    displayFileNode.value = props.fileTree
    return
  }
  const path = currentPath.value.split('/')
  if (props.fileTree === null)
    return
  let tree = props.fileTree
  for (let i = 0; i < path.length; i++) {
    const name = path[i]
    const child = tree.children.find(child => child.name === name)
    if (child)
      tree = child

    else
      return
  }
  displayFileNode.value = tree
}

function goPrevious() {
  if (isRootPath.value)
    return
  const path = currentPath.value.split('/')
  path.pop()
  currentPath.value = path.join('/')
  updateDisplayFiles()
}

function goPath(path: string) {
  currentPath.value = path
  updateDisplayFiles()
}

function refresh() {
  currentPath.value = ''
  updateDisplayFiles()
}

function handleClickFile(file: FileNode) {
  if (file.type === NodeType.Directory) {
    if (isRootPath.value)
      currentPath.value = file.name
    else
      currentPath.value += `/${file.name}`
    updateDisplayFiles()
  }
}

defineExpose({
  refresh,
})
</script>

<template>
  <!-- 顶部工具栏：搜索 + 视图切换 -->
  <div class="mb-2 flex flex-wrap items-center gap-2">
    <el-input
      v-model="searchQuery"
      placeholder="搜索文件名/路径"
      clearable
      class="w-[240px]"
      size="small"
    />
    <el-radio-group v-model="viewMode" size="small">
      <el-radio-button label="table">表格</el-radio-button>
      <el-radio-button label="grid">平铺</el-radio-button>
    </el-radio-group>
  </div>

  <!-- 面包屑：仅在非搜索时显示 -->
  <el-breadcrumb v-if="!isSearching" class="mb-2">
    <el-breadcrumb-item>
      <el-button text size="small" class="font-bold" @click="refresh">
        根目录
      </el-button>
    </el-breadcrumb-item>
    <el-breadcrumb-item v-for="path, index in breadcrumbItems" :key="index">
      <el-button text size="small" class="font-bold" @click="goPath(currentPath.split('/').slice(0, index + 1).join('/'))">
        {{ path }}
      </el-button>
    </el-breadcrumb-item>
  </el-breadcrumb>

  <!-- 平铺模式 -->
  <div v-if="displayFileNode && viewMode === 'grid'" class="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
    <!-- 返回上级：仅非根且非搜索 -->
    <div
      v-if="!isSearching"
      class="flex h-[72px] cursor-pointer items-center justify-center rounded border text-[#606266] transition-colors hover:bg-gray-100"
      :class="{ 'text-gray-400': isRootPath }"
      @click="goPrevious"
    >
      ..
    </div>
    <div
      v-for="file in (isSearching ? searchResults : displayFileNode.children)"
      :key="isSearching ? `${(file as SearchItem).path}/${(file as SearchItem).node.name}` : (file as FileNode).name"
      class="group rounded border p-2 transition-colors hover:bg-gray-100"
      :class="{ 'cursor-pointer text-yellow-600': (!isSearching && (file as any).type === NodeType.Directory) }"
      @click="!isSearching && (file as any).type === NodeType.Directory ? handleClickFile(file as any) : undefined"
    >
      <div class="mb-1 text-[#606266]">
        <template v-if="isSearching">
          <span class="text-xs text-gray-400">{{ (file as SearchItem).path }}</span>
        </template>
      </div>
      <div class="flex items-center gap-2">
        <template v-if="(isSearching ? (file as SearchItem).node.type : (file as FileNode).type) === NodeType.Directory">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="inline-block size-5 text-yellow-600">
            <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v3.26a3.235 3.235 0 0 1 1.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75ZM3.75 9A1.75 1.75 0 0 0 2 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-4.5A1.75 1.75 0 0 0 16.25 9H3.75Z" />
          </svg>
        </template>
        <template v-else>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="inline-block size-5">
            <path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z" />
          </svg>
        </template>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm text-[#606266]">
            {{ isSearching ? (file as SearchItem).node.name : (file as FileNode).name }}
          </div>
          <div class="text-xs text-gray-400">
            <template v-if="isSearching">
              {{ formatBytes((file as SearchItem).node.size) }}
            </template>
            <template v-else>
              <span v-if="(file as FileNode).type === NodeType.Directory">{{ ((file as FileNode).children.length) }} 项</span>
              <span v-else>{{ formatBytes((file as FileNode).size) }}</span>
            </template>
          </div>
        </div>
      </div>
      <div class="mt-2 text-right text-xs text-[#409eff]">
        <template v-if="(isSearching ? (file as SearchItem).node.type : (file as FileNode).type) === NodeType.File">
          <template v-if="isSearching">
            <button v-if="props.decompressedPath && (file as SearchItem).node.fileData" class="mr-1" @click.stop="openLink(`${props.decompressedPath}/${(file as SearchItem).node.fileData!.remoteName}`)">下载</button>
            <button v-if="(file as SearchItem).node.fileData?.md5" class="mr-1" @click.stop="copyToClipboard((file as SearchItem).node.fileData!.md5)">md5</button>
            <button v-if="(file as SearchItem).node.fileData?.hash" class="mr-1" @click.stop="copyToClipboard((file as SearchItem).node.fileData!.hash!)">hash</button>
          </template>
          <template v-else>
            <button v-if="decompressedPath && (file as FileNode).fileData" class="mr-1" @click.stop="openLink(`${decompressedPath}/${(file as FileNode).fileData!.remoteName}`)">下载</button>
            <button v-if="(file as FileNode).fileData?.md5" class="mr-1" @click.stop="copyToClipboard((file as FileNode).fileData!.md5)">md5</button>
            <button v-if="(file as FileNode).fileData?.hash" class="mr-1" @click.stop="copyToClipboard((file as FileNode).fileData!.hash!)">hash</button>
          </template>
        </template>
      </div>
    </div>
  </div>

  <!-- 表格模式（默认） -->
  <table v-if="displayFileNode && viewMode === 'table'" class="w-full text-xs text-[#606266]">
    <colgroup>
      <col class="w-6">
      <col>
      <col class="w-10">
      <col class="w-20">
      <col class="w-32">
    </colgroup>
    <thead>
      <tr class="text-left text-[#909399]">
        <th />
        <th>名称</th>
        <th>类型</th>
        <th>大小</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-if="!isSearching"
        class="h-[22px]"
        :class="{
          'text-gray-400': isRootPath,
          'cursor-pointer hover:bg-gray-100': !isRootPath,
        }"
        @click="goPrevious"
      >
        <td />
        <td>..</td>
        <td />
        <td />
        <td />
      </tr>
      <tr
        v-for="file in (isSearching ? searchResults : displayFileNode.children)"
        :key="isSearching ? `${(file as SearchItem).path}/${(file as SearchItem).node.name}` : (file as FileNode).name"
        class="transition-colors hover:bg-gray-100"
        :class="{
          'cursor-pointer text-yellow-600': !isSearching && (file as FileNode).type === NodeType.Directory,
        }"
        @click="!isSearching ? handleClickFile(file as FileNode) : undefined"
      >
        <td>
          <template v-if="(isSearching ? (file as SearchItem).node.type : (file as FileNode).type) === NodeType.Directory">
            <svg
              xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              class="inline-block size-5"
            >
              <path
                d="M3.75 3A1.75 1.75 0 0 0 2 4.75v3.26a3.235 3.235 0 0 1 1.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0 0 16.25 5h-4.836a.25.25 0 0 1-.177-.073L9.823 3.513A1.75 1.75 0 0 0 8.586 3H3.75ZM3.75 9A1.75 1.75 0 0 0 2 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25v-4.5A1.75 1.75 0 0 0 16.25 9H3.75Z"
              />
            </svg>
          </template>
          <template v-else>
            <svg
              xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              class="inline-block size-5"
            >
              <path
                d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Z"
              />
            </svg>
          </template>
        </td>
        <td class="truncate">
          {{ isSearching ? (file as SearchItem).node.name : (file as FileNode).name }}
          <template v-if="!isSearching && (file as FileNode).type === NodeType.Directory">
            ({{ (file as FileNode).children.length }})
          </template>
          <div v-if="isSearching" class="text-xs text-gray-400">{{ (file as SearchItem).path }}</div>
        </td>
        <td>{{ (isSearching ? (file as SearchItem).node.type : (file as FileNode).type) === NodeType.Directory ? '目录' : '文件' }}</td>
        <td>{{ formatBytes(isSearching ? (file as SearchItem).node.size : (file as FileNode).size) }}</td>
        <td class="text-[#409eff]">
          <template v-if="(isSearching ? (file as SearchItem).node.type : (file as FileNode).type) === NodeType.File">
            <template v-if="isSearching">
              <button v-if="decompressedPath && (file as SearchItem).node.fileData" class="mr-1" @click.stop="openLink(`${decompressedPath}/${(file as SearchItem).node.fileData!.remoteName}`)">
                下载
              </button>
              <button v-if="(file as SearchItem).node.fileData?.md5" class="mr-1" @click.stop="copyToClipboard((file as SearchItem).node.fileData!.md5)">
                md5
              </button>
              <button v-if="(file as SearchItem).node.fileData?.hash" class="mr-1" @click.stop="copyToClipboard((file as SearchItem).node.fileData!.hash!)">
                hash
              </button>
            </template>
            <template v-else>
              <button v-if="decompressedPath && (file as FileNode).fileData" class="mr-1" @click.stop="openLink(`${decompressedPath}/${(file as FileNode).fileData!.remoteName}`)">
                下载
              </button>
              <button v-if="(file as FileNode).fileData?.md5" class="mr-1" @click.stop="copyToClipboard((file as FileNode).fileData!.md5)">
                md5
              </button>
              <button v-if="(file as FileNode).fileData?.hash" class="mr-1" @click.stop="copyToClipboard((file as FileNode).fileData!.hash!)">
                hash
              </button>
            </template>
          </template>
        </td>
      </tr>
    </tbody>
  </table>
</template>
