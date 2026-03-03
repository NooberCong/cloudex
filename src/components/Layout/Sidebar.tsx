import React, { useEffect } from 'react'
import {
  Cloud, HardDrive, ChevronRight, ChevronDown,
  Loader2, Plus, Settings, AlertCircle, RefreshCw, Database, Pencil, Trash2
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useProvidersStore } from '../../store/providers'
import { useExplorerStore } from '../../store/explorer'
import type { ProviderConfig, BucketInfo } from '../../types'

interface SidebarProps {
  onAddProvider: () => void
  onOpenSettings: () => void
  onOpenExplorer?: () => void
  onEditProvider: (provider: ProviderConfig) => void
  onDeleteProvider: (provider: ProviderConfig) => void
}

const providerIcon = (type: ProviderConfig['type']) =>
  type === 'aws-s3' ? (
    <Cloud className="w-3.5 h-3.5 text-[#FF9900]" />
  ) : type === 'digitalocean-spaces' ? (
    <HardDrive className="w-3.5 h-3.5 text-[#0080FF]" />
  ) : type === 'minio-s3' ? (
    <HardDrive className="w-3.5 h-3.5 text-[#C72E49]" />
  ) : type === 'wasabi-s3' ? (
    <HardDrive className="w-3.5 h-3.5 text-[#74B72E]" />
  ) : type === 'backblaze-b2' ? (
    <HardDrive className="w-3.5 h-3.5 text-[#E85C33]" />
  ) : (
    <HardDrive className="w-3.5 h-3.5 text-[#F48120]" />
  )

const providerLabel = (type: ProviderConfig['type']) =>
  type === 'aws-s3'
    ? 'AWS S3'
    : (type === 'backblaze-b2'
      ? 'Backblaze B2'
      : (type === 'wasabi-s3'
        ? 'Wasabi'
        : (type === 'minio-s3' ? 'MinIO' : (type === 'digitalocean-spaces' ? 'DigitalOcean Spaces' : 'Cloudflare R2'))))

export function Sidebar({
  onAddProvider,
  onOpenSettings,
  onOpenExplorer,
  onEditProvider,
  onDeleteProvider
}: SidebarProps) {
  const {
    providers,
    buckets,
    loading,
    initialized,
    loadProviders,
    loadBuckets,
    toggleProviderExpanded,
    expandedProviders
  } = useProvidersStore()

  const { location, navigate, refresh } = useExplorerStore()

  useEffect(() => {
    if (!initialized) loadProviders()
  }, [initialized])

  const handleProviderClick = async (provider: ProviderConfig) => {
    toggleProviderExpanded(provider.id)
    if (!expandedProviders.includes(provider.id)) {
      // expanding
      const state = buckets[provider.id]
      if (!state || (!state.loading && state.buckets.length === 0 && !state.error)) {
        await loadBuckets(provider.id)
      }
    }
  }

  const handleBucketClick = (provider: ProviderConfig, bucket: BucketInfo) => {
    navigate({ providerId: provider.id, bucket: bucket.name, prefix: '' })
    onOpenExplorer?.()
  }

  const handleRefreshProvider = async (provider: ProviderConfig) => {
    await loadBuckets(provider.id)
    if (location?.providerId === provider.id) {
      await refresh()
    }
  }

  return (
    <aside
      className="flex flex-col h-full border-r border-[var(--border)]"
      style={{ width: 'var(--sidebar-width)', background: 'var(--bg-secondary)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] drag-region"
        style={{ height: 'var(--titlebar-height)' }}
      >
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider no-drag">
          Storage
        </span>
        <button
          onClick={onAddProvider}
          className="no-drag p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Add provider"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Provider tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && !initialized && (
          <div className="flex items-center gap-2 px-4 py-3 text-[var(--text-muted)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        )}

        {initialized && providers.length === 0 && (
          <div className="px-4 py-6 text-center">
            <Database className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-xs text-[var(--text-muted)] mb-3">No storage providers</p>
            <button
              onClick={onAddProvider}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Add your first provider
            </button>
          </div>
        )}

        {providers.map((provider) => {
          const isExpanded = expandedProviders.includes(provider.id)
          const bucketState = buckets[provider.id]

          return (
            <div key={provider.id}>
              {/* Provider row */}
              <button
                onClick={() => handleProviderClick(provider)}
                className={cn(
                  'relative w-full flex items-center gap-2 px-3 py-1.5 text-left group',
                  'hover:bg-[var(--bg-hover)] transition-colors',
                  'text-[var(--text-primary)]'
                )}
              >
                <span className="text-[var(--text-muted)]">
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </span>
                {providerIcon(provider.type)}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="flex-1 text-xs font-medium truncate" title={provider.name}>
                    {provider.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0 transition-opacity group-hover:opacity-0">
                    {providerLabel(provider.type)}
                  </span>
                </div>
                <div className="absolute right-2 flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={async (e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      await handleRefreshProvider(provider)
                    }}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    title="Refresh connection"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onEditProvider(provider)
                    }}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    title="Edit provider"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onDeleteProvider(provider)
                    }}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--danger)]"
                    title="Delete provider"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </button>

              {/* Buckets */}
              {isExpanded && (
                <div className="pl-4">
                  {bucketState?.loading && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-[var(--text-muted)]">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs">Loading buckets…</span>
                    </div>
                  )}

                  {bucketState?.error && (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-[var(--danger)]">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span className="text-xs truncate">{bucketState.error}</span>
                      <button
                        onClick={() => loadBuckets(provider.id)}
                        className="shrink-0 p-0.5 hover:bg-[var(--bg-hover)] rounded"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {bucketState?.buckets.map((bucket) => {
                    const isActive =
                      location?.providerId === provider.id && location?.bucket === bucket.name

                    return (
                      <button
                        key={bucket.name}
                        onClick={() => handleBucketClick(provider, bucket)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-1.5 text-left rounded-md mx-1',
                          'transition-colors text-xs',
                          isActive
                            ? 'bg-[var(--bg-selected)] text-[var(--accent)] font-medium'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                        )}
                        style={{ width: 'calc(100% - 8px)' }}
                      >
                        <Database className="w-3 h-3 shrink-0 opacity-60" />
                        <span className="truncate" title={bucket.name}>{bucket.name}</span>
                      </button>
                    )
                  })}

                  {bucketState && !bucketState.loading && !bucketState.error && bucketState.buckets.length === 0 && (
                    <p className="px-3 py-1.5 text-xs text-[var(--text-muted)]">No buckets found</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="h-px w-full bg-[var(--border)]" />

      {/* Footer */}
      <div className="p-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </div>
    </aside>
  )
}
