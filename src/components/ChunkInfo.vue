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
</script>

<template>
  <div>
    <el-space class="mb-2">
      <status-tag title="包体ID">
        {{ info.package_id }}
      </status-tag>
      <status-tag title="构建ID">
        {{ data?.build_id }}
      </status-tag>
      <status-tag title="标签">
        {{ info.tag }}
      </status-tag>
    </el-space>
    <el-tabs type="border-card">
      <el-tab-pane v-for="manifest in manifests" :key="manifest.value" :label="manifest.label">
        <el-descriptions
          v-if="manifest"
          :column="3"
          border
          size="small"
        >
          <el-descriptions-item :span="3">
            <template #label>
              Manifest ID
            </template>
            <CopyAbleText :text="manifest.manifest.id" />
          </el-descriptions-item>
          <el-descriptions-item>
            <template #label>
              未压缩大小
            </template>
            {{ manifest.stats.uncompressed_size }} ({{ formatBytes(manifest.stats.uncompressed_size) }})
          </el-descriptions-item>
          <el-descriptions-item>
            <template #label>
              文件数量
            </template>
            {{ manifest.stats.file_count }}
          </el-descriptions-item>
          <el-descriptions-item>
            <template #label>
              文件块数量
            </template>
            {{ manifest.stats.chunk_count }}
          </el-descriptions-item>
        </el-descriptions>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
