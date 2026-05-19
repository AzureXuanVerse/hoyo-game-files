import versionsData from '@/assets/usm/versions.json'

const MASK56 = 0xFFFFFFFFFFFFFFn
const BASE = 0x100000000000000n

const INTRO_REMAP: Record<string, string> = {
  MDAQ001_OPNew_Part1: 'MDAQ001_OP',
  MDAQ001_OPNew_Part2_PlayerBoy: 'MDAQ001_OP',
  MDAQ001_OPNew_Part2_PlayerGirl: 'MDAQ001_OP',
}

function computeFilenameKey(name: string): bigint {
  const base = INTRO_REMAP[name] ?? name
  let sum = 0n
  for (const c of base)
    sum = BigInt(c.charCodeAt(0)) + 3n * sum
  sum &= MASK56
  return sum > 0n ? sum : BASE
}

function computeFinalKey(name: string, versionKey: bigint): string {
  const key1 = computeFilenameKey(name)
  const combined = (key1 + versionKey) & MASK56
  const final = combined > 0n ? combined : BASE
  return final.toString(16).toUpperCase().padStart(16, '0')
}

interface UsmVersionEntry {
  version: string
  key?: number
  videos?: string[]
  videoGroups?: Array<{ version: string, key?: number, videos?: string[] }>
  encAudio?: boolean
}

let keyMap: Map<string, string> | null = null

function buildKeyMap(): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of versionsData.list as UsmVersionEntry[]) {
    if (entry.videos) {
      const versionKey = BigInt(entry.key ?? 0)
      for (const name of entry.videos)
        map.set(name, computeFinalKey(name, versionKey))
    }
    if (entry.videoGroups) {
      for (const group of entry.videoGroups) {
        if (group.videos) {
          const versionKey = BigInt(group.key ?? 0)
          for (const name of group.videos)
            map.set(name, computeFinalKey(name, versionKey))
        }
      }
    }
  }
  return map
}

export function findUsmKey(filename: string): string | null {
  if (!keyMap)
    keyMap = buildKeyMap()
  const base = filename.replace(/\.usm$/i, '').replace(/^.*[/\\]/, '')
  return keyMap.get(base) ?? null
}

let wasmInitPromise: Promise<void> | null = null

export async function initWasm(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = (async () => {
      const mod = await import('@/assets/usm/usm_decoder.js')
      await mod.default()
    })()
  }
  return wasmInitPromise
}

export async function getUsmStreamDecryptor(keyHex: string) {
  await initWasm()
  const { UsmStreamDecryptor } = await import('@/assets/usm/usm_decoder.js')
  return new UsmStreamDecryptor(keyHex)
}

export async function decryptUsm(data: Uint8Array, keyHex: string): Promise<Uint8Array> {
  await initWasm()
  const { decrypt_usm } = await import('@/assets/usm/usm_decoder.js')
  const result = decrypt_usm(data, keyHex)
  return result.video_webm as Uint8Array
}
