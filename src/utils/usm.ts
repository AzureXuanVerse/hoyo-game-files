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

export async function getUsmStreamDecoder(keyHex: string) {
  await initWasm()
  const { UsmStreamDecoder } = await import('@/assets/usm/usm_decoder.js')
  return new UsmStreamDecoder(keyHex)
}

export interface UsmAudioChannel {
  channel: number
  wav: Uint8Array
}

export interface DecodeUsmResult {
  videoWebm: Uint8Array
  audioChannels: UsmAudioChannel[]
}

export async function decodeUsm(data: Uint8Array, keyHex: string): Promise<DecodeUsmResult> {
  await initWasm()
  const { decode_usm } = await import('@/assets/usm/usm_decoder.js')
  const result = decode_usm(data, keyHex)
  return {
    videoWebm: result.video_webm as Uint8Array,
    audioChannels: (result.audio_channels ?? []) as UsmAudioChannel[],
  }
}
