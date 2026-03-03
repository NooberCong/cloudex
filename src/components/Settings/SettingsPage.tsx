import React from 'react'
import { Pencil, Trash2, Plus, Cloud, HardDrive, Moon, Sun, Monitor } from 'lucide-react'
import { Button } from '../UI/Button'
import { useProvidersStore } from '../../store/providers'
import type { ProviderConfig, Theme } from '../../types'

interface SettingsPageProps {
  onClose: () => void
  onEditProvider: (p: ProviderConfig) => void
  onAddProvider: () => void
  onDeleteProvider: (p: ProviderConfig) => void
  deletingProviderId?: string | null
  theme: Theme
  onThemeChange: (t: Theme) => void
}

export function SettingsPage({
  onClose, onEditProvider, onAddProvider, onDeleteProvider, deletingProviderId, theme, onThemeChange
}: SettingsPageProps) {
  const { providers } = useProvidersStore()

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] animate-fade-in">
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 border-b border-[var(--border)] drag-region shrink-0"
        style={{ height: 'var(--titlebar-height)' }}
      >
        <h1 className="text-sm font-semibold text-[var(--text-primary)] no-drag">Settings</h1>
        <Button variant="ghost" size="sm" onClick={onClose} className="no-drag">
          ← Back
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Providers */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Storage Providers
            </h2>
            <Button variant="outline" size="xs" icon={<Plus className="w-3 h-3" />} onClick={onAddProvider}>
              Add
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
                  className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center shrink-0">
                    {p.type === 'aws-s3' ? (
                      <Cloud className="w-4 h-4 text-[#FF9900]" />
                    ) : (
                      <HardDrive className="w-4 h-4 text-[#F48120]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate" title={p.name}>
                      {p.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {p.type === 'aws-s3' ? 'AWS S3' : 'Cloudflare R2'} · {p.region}
                      {p.endpoint ? ` · ${new URL(p.endpoint).hostname}` : ''}
                      {(p.defaultBucket || p.allowedBuckets?.[0])
                        ? ` · bucket: ${p.defaultBucket || p.allowedBuckets?.[0]}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={<Pencil className="w-3 h-3" />}
                      onClick={() => onEditProvider(p)}
                      title="Edit"
                    />
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={<Trash2 className="w-3 h-3 text-[var(--danger)]" />}
                      loading={deletingProviderId === p.id}
                      onClick={() => onDeleteProvider(p)}
                      title="Remove"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Appearance */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Appearance
          </h2>
          <div>
            <label className="text-xs text-[var(--text-secondary)] mb-2 block">Theme</label>
            <div className="flex gap-2">
              {([
                { value: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
                { value: 'dark',  label: 'Dark',  icon: <Moon className="w-3.5 h-3.5" /> },
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

        {/* About */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            About
          </h2>
          <div className="p-3 rounded-xl border border-[var(--border)] space-y-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">CloudEx</p>
            <p className="text-xs text-[var(--text-muted)]">Desktop file manager for AWS S3 &amp; Cloudflare R2</p>
          </div>
        </section>
      </div>
    </div>
  )
}
