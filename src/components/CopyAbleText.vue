<script setup lang="ts">
import { copyToClipboard } from '@/utils'

defineProps<{ text: string | undefined }>()
</script>

<template>
  <el-button link size="small" class="!p-0" @click="copyToClipboard(text || '')">
    {{ text }}
  </el-button>
</template>
