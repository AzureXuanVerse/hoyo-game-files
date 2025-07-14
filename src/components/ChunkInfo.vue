<script setup lang="ts">
import type { ChunkData, ChunkInfo } from '@/types'
import { formatBytes } from '@/utils'

const props = defineProps<{
  info: ChunkInfo
  data: ChunkData | null
}>()

const manifests = computed(() => {
  return (props.data?.manifests || []).map((manifest) => {
    return {
      ...manifest,
      value: manifest.category_id,
      label: manifest.category_name,
    }
  })
})

const manifestStats = computed(() => {
  const info = {
    compressed_size: 0,
    uncompressed_size: 0,
    file_count: 0,
    chunk_count: 0,
  }
  manifests.value.forEach((manifest) => {
    info.compressed_size += Number(manifest.stats.compressed_size)
    info.uncompressed_size += Number(manifest.stats.uncompressed_size)
    info.file_count += Number(manifest.stats.file_count)
    info.chunk_count += Number(manifest.stats.chunk_count)
  })
  return info
})

// function handleViewManifestFiles(manifest: any) {

// }
</script>

<template>
  <div>
    <el-space class="mb-2" wrap>
      <status-tag title="包体ID">
        <CopyAbleText :text="info.package_id" />
      </status-tag>
      <status-tag title="构建ID">
        <CopyAbleText :text="data?.build_id" />
      </status-tag>
      <status-tag title="标签">
        {{ info.tag }}
      </status-tag>
      <status-tag title="分类数量">
        {{ manifests.length }}
      </status-tag>
      <status-tag title="文件数量">
        {{ manifestStats.file_count }}
      </status-tag>
      <status-tag title="文件块数量">
        {{ manifestStats.chunk_count }}
      </status-tag>
      <status-tag title="文件大小(压缩)">
        {{ formatBytes(manifestStats.compressed_size) }}
      </status-tag>
      <status-tag title="文件大小(未压缩)">
        {{ formatBytes(manifestStats.uncompressed_size) }}
      </status-tag>
    </el-space>
    <el-table
      :data="manifests" style="width: 100%" size="small" max-height="300"
    >
      <el-table-column prop="label" label="名称" min-width="200" show-overflow-tooltip />
      <el-table-column prop="manifest.id" label="Manifest ID" min-width="200" show-overflow-tooltip />
      <el-table-column prop="stats.file_count" label="文件数量" width="100" />
      <el-table-column prop="stats.file_count" label="文件块数量" width="100" />
      <el-table-column prop="stats.uncompressed_size" label="文件大小(未压缩)" width="150">
        <template #default="{ row }">
          {{ formatBytes(row.stats.uncompressed_size) }}
        </template>
      </el-table-column>
      <!-- <el-table-column fixed="right" width="120">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="handleViewManifestFiles(row)">
            查看文件列表
          </el-button>
        </template>
      </el-table-column> -->
    </el-table>
  </div>
</template>
