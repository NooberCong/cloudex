import React from 'react'
import { Pencil, Trash2, Plus, Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '../UI/Button'
import { useProvidersStore } from '../../store/providers'
import type { ProviderConfig, Theme } from '../../types'
import { ProviderIcon, getProviderLabel } from '../Providers/ProviderIcon'

interface SettingsPageProps {
  onClose: () => void
  onEditProvider: (p: ProviderConfig) => void
  onAddProvider: () => void
  onDeleteProvider: (p: ProviderConfig) => void
  deletingProviderId?: string | null
  theme: Theme
  onThemeChange: (t: Theme) => void
}

function tryGetHostname(urlOrHost?: string): string | undefined {
  if (!urlOrHost) return undefined
  try {
    return new URL(urlOrHost).hostname
  } catch {
    return urlOrHost.replace(/^https?:\/\//i, '')
  }
}

function getProviderDetails(p: ProviderConfig): string {
  const parts: string[] = [getProviderLabel(p.type)]
  const scopedBucket = p.defaultBucket || p.allowedBuckets?.[0]

  if (p.type === 'azure-blob-storage') {
    const accountName = p.accessKeyId?.trim()
    if (accountName) parts.push(`account: ${accountName}`)
    const endpoint = p.endpoint?.trim() || (accountName ? `https://${accountName}.blob.core.windows.net` : undefined)
    const host = tryGetHostname(endpoint)
    if (host) parts.push(host)
    if (scopedBucket) parts.push(`container: ${scopedBucket}`)
    return parts.join(' - ')
  }

  if (p.region?.trim()) parts.push(p.region.trim())
  if (p.type === 'google-cloud-storage') {
    const host = tryGetHostname(p.endpoint?.trim() || 'https://storage.googleapis.com')
    if (host) parts.push(host)
  } else if (p.endpoint) {
    const host = tryGetHostname(p.endpoint)
    if (host) parts.push(host)
  }
  if (scopedBucket) parts.push(`bucket: ${scopedBucket}`)
  return parts.join(' - ')
}

export function SettingsPage({
  onClose, onEditProvider, onAddProvider, onDeleteProvider, deletingProviderId, theme, onThemeChange
}: SettingsPageProps) {
  const { providers } = useProvidersStore()

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] animate-fade-in">
      <div
        className="flex items-center justify-between px-6 border-b border-[var(--border)] drag-region shrink-0"
        style={{ height: 'var(--titlebar-height)' }}
      >
        <h1 className="text-sm font-semibold text-[var(--text-primary)] no-drag">Settings</h1>
        <Button variant="ghost" size="sm" onClick={onClose} className="no-drag">
          {'< Back'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Storage Providers
            </h2>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={onAddProvider}
              className="h-8 rounded-lg shadow-sm"
            >
              Add Provider
            </Button>
          </div>

          {providers.length === 0 ? (
            <div className="text-center py-8 text-xs text-[var(--text-muted)]">
              No providers configured yet.
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)] transition-colors shadow-[0_1px_0_0_rgba(0,0,0,0.04)]"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
                    <ProviderIcon type={p.type} className="w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate" title={p.name}>
                      {p.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {getProviderDetails(p)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditProvider(p)}
                      title="Edit provider"
                      className="h-8 w-8 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] transition-colors inline-flex items-center justify-center"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteProvider(p)}
                      title="Delete provider"
                      disabled={deletingProviderId === p.id}
                      className="h-8 w-8 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[color-mix(in_srgb,var(--danger)_50%,var(--border))] hover:bg-[var(--danger-light)] transition-colors inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingProviderId === p.id ? (
                        <span className="inline-block w-3.5 h-3.5 border-2 border-[var(--danger)] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Appearance
          </h2>
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-2 block">Theme</label>
            <div className="flex gap-2">
              {([
                { value: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
                { value: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
                { value: 'system', label: 'System', icon: <Monitor className="w-3.5 h-3.5" /> }
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onThemeChange(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs rounded-lg border font-medium transition-all ${
                    theme === opt.value
                      ? 'bg-[var(--accent-light)] border-[var(--accent)] text-[var(--accent)]'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            About
          </h2>
          <div className="p-3 rounded-xl border border-[var(--border)] space-y-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">CloudEx</p>
            <p className="text-xs text-[var(--text-muted)]">
              Desktop file manager for AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO, DigitalOcean Spaces, Google Cloud Storage, and Azure Blob Storage
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
