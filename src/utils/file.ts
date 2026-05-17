export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes < 0)
    return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx++
  }
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`
}
