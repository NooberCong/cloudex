export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatBytes(bytes: number | undefined, decimals = 1): string {
  if (bytes == null) return '—'
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function formatDate(date: Date | string | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatSpeed(bytesPerSec: number | undefined): string {
  if (!bytesPerSec) return ''
  return `${formatBytes(bytesPerSec)}/s`
}

export function formatEta(seconds: number | undefined): string {
  if (!seconds || seconds < 1) return ''
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export function getFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return ''
  return name.substring(dot + 1).toLowerCase()
}

export function isImageFile(name: string): boolean {
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(
    getFileExtension(name)
  )
}

export function isTextFile(name: string): boolean {
  return [
    'txt', 'md', 'json', 'yaml', 'yml', 'toml', 'xml', 'html', 'htm',
    'css', 'js', 'ts', 'tsx', 'jsx', 'sh', 'bash', 'zsh', 'fish',
    'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
    'sql', 'env', 'gitignore', 'dockerfile', 'makefile', 'ini', 'cfg', 'conf'
  ].includes(getFileExtension(name))
}

/**
 * Build breadcrumb segments from a bucket name + prefix.
 * Returns an array of { label, prefix } where prefix is the accumulated path.
 */
export function buildBreadcrumbs(
  bucket: string,
  prefix: string
): Array<{ label: string; prefix: string }> {
  const crumbs: Array<{ label: string; prefix: string }> = [{ label: bucket, prefix: '' }]
  if (!prefix) return crumbs

  const parts = prefix.split('/').filter(Boolean)
  let acc = ''
  for (const part of parts) {
    acc += part + '/'
    crumbs.push({ label: part, prefix: acc })
  }
  return crumbs
}
