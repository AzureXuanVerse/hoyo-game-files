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
