<script setup lang="ts">
import type { FileInfoWithType } from '@/types'
import { copyToClipboard, formatBytes, openLink } from '@/utils'

const props = defineProps<{
  data: FileInfoWithType[]
}>()

const selection = ref<FileInfoWithType[]>([])

function handleSelectionChange(val: FileInfoWithType[]) {
  selection.value = val
}

function handleCopyAll() {
  const urls = props.data.map(item => item.url).join('\n')
  copyToClipboard(urls)
}

function handleCopySelected() {
  const urls = selection.value.map(item => item.url).join('\n')
  copyToClipboard(urls)
}

function getFileTotalSize(files: FileInfoWithType[]) {
  return formatBytes(files.reduce((total, file) => total + file.size, 0))
}
</script>

<template>
  <el-space class="mb-2">
    <status-tag title="文件数量">
      {{ data.length }}
    </status-tag>
    <status-tag title="文件大小">
      {{ getFileTotalSize(data) }}
    </status-tag>
    <el-button size="small" round @click="handleCopyAll">
      复制全部链接
    </el-button>
    <el-button v-if="selection.length !== 0" size="small" round @click="handleCopySelected">
      复制选中链接
    </el-button>
  </el-space>
  <el-table
    :data="data" style="width: 100%" size="small" max-height="250"
    @selection-change="handleSelectionChange"
  >
    <el-table-column type="selection" width="28" />
    <el-table-column prop="name" label="文件名" min-width="200" show-overflow-tooltip />
    <el-table-column prop="type" label="类型" width="100" />
    <el-table-column prop="size" label="文件大小" width="120">
      <template #default="scope">
        <span>{{ formatBytes(scope.row.size) }}</span>
      </template>
    </el-table-column>
    <el-table-column prop="checksum" label="校验信息" width="250">
      <template #default="scope">
        <CopyAbleText :text="scope.row.checksum" />
      </template>
    </el-table-column>
    <el-table-column fixed="right" width="120">
      <template #default="scope">
        <el-button link type="primary" size="small" @click="copyToClipboard(scope.row.url)">
          复制链接
        </el-button>
        <el-button link type="primary" size="small" @click="openLink(scope.row.url)">
          下载
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
