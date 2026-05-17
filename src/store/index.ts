import { defineStore } from 'pinia'

type Theme = 'device' | 'light' | 'dark'

export const useAppStore = defineStore('app', () => {
  const theme = ref<Theme>('device')
  const isDark = ref(false)

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

  function updateIsDark() {
    isDark.value = theme.value === 'device' ? mediaQuery.matches : theme.value === 'dark'
  }

  function applyTheme() {
    document.documentElement.classList.toggle('dark', isDark.value)
  }

  function onSystemChange() {
    if (theme.value === 'device') {
      updateIsDark()
      applyTheme()
    }
  }

  function initTheme() {
    const saved = localStorage.getItem('theme') as Theme | null
    theme.value = saved && ['device', 'light', 'dark'].includes(saved) ? saved : 'device'
    updateIsDark()
    applyTheme()
    mediaQuery.addEventListener('change', onSystemChange)
  }

  function cycleTheme() {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  function setTheme(t: Theme) {
    theme.value = t
    if (t === 'device')
      localStorage.removeItem('theme')
    else
      localStorage.setItem('theme', t)
    updateIsDark()
    applyTheme()
  }

  return { theme, isDark, initTheme, setTheme, cycleTheme }
})
