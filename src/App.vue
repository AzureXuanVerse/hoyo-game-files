<script setup lang="ts">
import { useAppStore } from '@/store'

const store = useAppStore()
const route = useRoute()

onMounted(() => {
  store.initTheme()
})

const isGameView = computed(() => route.name === 'Game')
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
    <NavBar class="md:hidden" />

    <div class="flex flex-1 overflow-hidden">
      <SideGameList class="hidden md:flex" />

      <SidePageList v-if="isGameView" class="hidden md:flex" />

      <main class="flex-1 overflow-auto">
        <RouterView />
      </main>
    </div>

    <DownloadList />
  </div>
</template>
