<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <span class="overflow-hidden text-nowrap rounded-full border border-gray-200 text-xs leading-[24px] text-gray-500">
    <span>
      <span class="inline-block border-r border-gray-200 bg-gray-100 pl-[9px] pr-[5px]">
        {{ title }}
      </span>
      <span class="inline-block pl-[5px] pr-[9px]">
        <slot />
      </span>
    </span>
  </span>
</template>
