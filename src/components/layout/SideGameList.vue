<script setup lang="ts">
import { GameList } from '@/constants/core'
import { useAppStore } from '@/store'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const currentGameId = computed(() => route.params.gameId as string)

function switchGame(gameId: string) {
  const pageId = route.params.pageId as string || 'home'
  router.push(`/${gameId}/${pageId}`)
}

function goSettings() {
  router.push('/settings')
}
</script>

<template>
  <aside class="flex h-full w-16 flex-col items-center gap-2 border-r border-gray-200 bg-gray-50 py-3 dark:border-gray-700 dark:bg-gray-900">
    <div class="flex flex-1 flex-col items-center gap-2">
      <button
        v-for="game in GameList"
        :key="game.id"
        :title="game.name"
        class="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150"
        :class="currentGameId === game.id
          ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-gray-50 dark:ring-offset-gray-900'
          : 'opacity-60 hover:opacity-100'"
        @click="switchGame(game.id)"
      >
        <img
          :src="`/images/icon/${game.id}.png`"
          :alt="game.name"
          class="h-9 w-9 rounded-xl object-cover"
        >
        <span
          class="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700"
        >
          {{ game.name }}
        </span>
      </button>
    </div>

    <button
      class="group relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
      title="切换主题模式"
      @click="store.cycleTheme()"
    >
      <LucideSun v-if="!store.isDark" class="h-5 w-5" />
      <LucideMoon v-else class="h-5 w-5" />
      <span
        class="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700"
      >
        {{ store.theme === 'device' ? '跟随设备' : store.theme === 'light' ? '亮色' : '暗色' }}
      </span>
    </button>

    <button
      title="设置"
      class="group relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
      :class="route.path === '/settings' ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100' : ''"
      @click="goSettings"
    >
      <LucideSettings class="h-5 w-5" />
      <span
        class="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700"
      >
        设置
      </span>
    </button>
  </aside>
</template>
