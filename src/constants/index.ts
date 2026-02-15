import type { GameConfig } from '@/types'

export const API_BASE = import.meta.env.VITE_API_BASE || '.'
export const API_BASE_FALLBACK = import.meta.env.VITE_API_BASE_FALLBACK || ''

export const GITHUB_REPO_URL = 'https://github.com/orilights/hoyo-files'

export const DEFAULT_GAME = 'hk4e'

export const GAME_CONFIG: Record<string, GameConfig>
 = {
   hk4e: {
     name: '原神',
     icon: '/icon/hk4e.png',
     voice: ['汉语', '英语', '日语', '韩语'],
   },
   hkrpg: {
     name: '崩坏：星穹铁道',
     icon: '/icon/hkrpg.png',
     voice: [],
   },
   nap: {
     name: '绝区零',
     icon: '/icon/nap.png',
     voice: ['汉语', '英语', '日语', '韩语'],
   },
   bh3: {
     name: '崩坏3',
     icon: '/icon/bh3.png',
     voice: [],
   },
 }

export const VOICEPACK_LIST: Record<string, string> = {
  汉语: 'Audio_Chinese_pkg_version',
  英语: 'Audio_English(US)_pkg_version',
  日语: 'Audio_Japanese_pkg_version',
  韩语: 'Audio_Korean_pkg_version',
}

export const GAME_TIP_TEXT: Record<string, string> = {
  hk4e: '原神已从 5.6.0 版本开始停止使用压缩包分发游戏资源，后续版本仅可通过 chunk 获取',
  // hkrpg: '崩坏：星穹铁道已从 3.8.0 版本开始延迟分发压缩包资源，3.8.0 版本压缩包为更新当天下午 5 点发布',
  bh3: '崩坏3已从 8.5.0 版本开始停止使用压缩包分发游戏资源，后续版本仅可通过 chunk 获取',
}
