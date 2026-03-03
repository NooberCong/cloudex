import React, { useState, useEffect, useRef } from 'react'
import { Trash2, FolderPlus, Copy, Check, ExternalLink, AlertTriangle } from 'lucide-react'
import { Dialog } from '../UI/Dialog'
import { Button } from '../UI/Button'
import { formatBytes, formatDate } from '../../lib/utils'
import type { S3Object, ObjectMetadata } from '../../types'

// ─── Delete Dialog ─────────────────────────────────────────────────────────────

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  keys: string[]
  onConfirm: () => Promise<void>
}

export function DeleteDialog({ open, onOpenChange, keys, onConfirm }: DeleteDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Delete Items" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--danger-light)]">
          <Trash2 className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-primary)]">
            Are you sure you want to delete{' '}
            <strong>{keys.length === 1 ? '1 item' : `${keys.length} items`}</strong>?
            This action cannot be undone.
          </p>
        </div>
        {keys.length <= 5 && (
          <ul className="space-y-1">
            {keys.map((k) => (
              <li key={k} className="text-xs text-[var(--text-muted)] truncate px-1">
                {k.split('/').pop() || k}
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={loading} onClick={handleConfirm} data-dialog-confirm="true">
            Delete {keys.length > 1 ? `${keys.length} items` : ''}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Rename Dialog ─────────────────────────────────────────────────────────────

interface RenameDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  object: S3Object | null
  onConfirm: (newName: string) => Promise<void>
}

export function RenameDialog({ open, onOpenChange, object, onConfirm }: RenameDialogProps) {
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open && object) {
      setNewName(object.name.replace(/\/$/, ''))
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          // Select without extension for files
          const dotIdx = object.name.lastIndexOf('.')
          if (!object.isFolder && dotIdx > 0) {
            inputRef.current.setSelectionRange(0, dotIdx)
          } else {
            inputRef.current.select()
          }
        }
      }, 50)
    }
  }, [open, object])

  const handleConfirm = async () => {
    if (!newName.trim() || !object) return
    setLoading(true)
    try {
      await onConfirm(newName.trim())
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Rename" size="sm">
      <div className="space-y-4">
        <input
          ref={inputRef}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New name"
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          style={{ userSelect: 'auto' }}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" size="sm" loading={loading} onClick={handleConfirm} data-dialog-confirm="true">
            Rename
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── New Folder Dialog ─────────────────────────────────────────────────────────

interface NewFolderDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (name: string) => Promise<void>
}

export function NewFolderDialog({ open, onOpenChange, onConfirm }: NewFolderDialogProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleConfirm = async () => {
    const trimmed = name.trim().replace(/[/\\]+/g, '').replace(/\s+/g, '-')
    if (!trimmed) return
    setLoading(true)
    try {
      await onConfirm(trimmed)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New Folder" size="sm">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-[#60a5fa] shrink-0" />
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            style={{ userSelect: 'auto' }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" size="sm" loading={loading} onClick={handleConfirm} data-dialog-confirm="true"
            disabled={!name.trim()}>
            Create Folder
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Presigned URL Dialog ──────────────────────────────────────────────────────

interface UploadConflictDialogProps {
  open: boolean
  path: string
  onOverwrite: () => void
  onSkip: () => void
  onCancelUpload: () => void
}

export function UploadConflictDialog({
  open, path, onOverwrite, onSkip, onCancelUpload
}: UploadConflictDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) onSkip() }}
      title="File Already Exists"
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--warning)]/10">
          <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" />
          <div className="text-sm text-[var(--text-primary)] min-w-0">
            <p className="mb-1">This file already exists:</p>
            <p className="text-xs text-[var(--text-secondary)] font-mono break-all">{path}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="outline" size="sm" onClick={onCancelUpload}>Cancel Upload</Button>
          <Button variant="ghost" size="sm" onClick={onSkip}>Skip</Button>
          <Button variant="primary" size="sm" onClick={onOverwrite} data-dialog-confirm="true">Overwrite</Button>
        </div>
      </div>
    </Dialog>
  )
}

interface RenameConflictDialogProps {
  open: boolean
  path: string
  onReplace: () => Promise<void>
  onCancel: () => void
  title?: string
  confirmLabel?: string
}

export function RenameConflictDialog({
  open,
  path,
  onReplace,
  onCancel,
  title = 'Name Already Exists',
  confirmLabel = 'Replace'
}: RenameConflictDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleReplace = async () => {
    setLoading(true)
    try {
      await onReplace()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) onCancel() }}
      title={title}
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--warning)]/10">
          <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0 mt-0.5" />
          <div className="text-sm text-[var(--text-primary)] min-w-0">
            <p className="mb-1">An item with this name already exists:</p>
            <p className="text-xs text-[var(--text-secondary)] font-mono break-all">{path}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={handleReplace} loading={loading} data-dialog-confirm="true">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface ProviderDeleteDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  providerName: string
  onConfirm: () => Promise<void>
}

export function ProviderDeleteDialog({
  open,
  onOpenChange,
  providerName,
  onConfirm
}: ProviderDeleteDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Delete Provider" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--danger-light)]">
          <Trash2 className="w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-primary)]">
            Remove provider <strong>{providerName}</strong>? You will lose saved credentials for this connection.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={loading} onClick={handleConfirm} data-dialog-confirm="true">
            Delete Provider
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

interface PresignedUrlDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  object: S3Object | null
  providerId: string
  bucket: string
}

export function PresignedUrlDialog({
  open, onOpenChange, object, providerId, bucket
}: PresignedUrlDialogProps) {
  const [expiry, setExpiry] = useState(3600)
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const MIN_LOADING_MS = 200

  const generate = async () => {
    if (!object) return
    const startedAt = Date.now()
    setLoading(true)
    try {
      const result = await window.api.objects.presignedUrl({
        providerId,
        bucket,
        key: object.key,
        expiresIn: expiry
      })
      setUrl(result)
    } finally {
      const elapsed = Date.now() - startedAt
      if (elapsed < MIN_LOADING_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_LOADING_MS - elapsed))
      }
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && object) {
      setUrl('')
      setCopied(false)
    }
  }, [open, object])

  useEffect(() => {
    if (open && object) {
      generate()
    }
  }, [open, object, expiry])

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const EXPIRY_OPTIONS = [
    { label: '15 min', value: 900 },
    { label: '1 hour', value: 3600 },
    { label: '24 hours', value: 86400 },
    { label: '7 days', value: 604800 }
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Presigned URL" size="md">
      <div className="space-y-4">
        <p className="text-xs text-[var(--text-muted)]">
          Generate a time-limited URL to share <strong className="text-[var(--text-primary)]">{object?.name}</strong>
        </p>

        {/* Expiry selector */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Expires in</label>
            {loading && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Updating…
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {EXPIRY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setExpiry(opt.value)}
                className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-all ${
                  expiry === opt.value
                    ? 'bg-[var(--accent-light)] border-[var(--accent)] text-[var(--accent)]'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* URL display */}
        <div className="relative">
          <input
            readOnly
            value={url}
            placeholder={loading ? 'Generating...' : ''}
            className="pr-20 text-xs font-mono"
            style={{ userSelect: 'auto' }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <button
              onClick={copy}
              disabled={!url || loading}
              className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40"
              title="Copy URL"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => !url && e.preventDefault()}
              className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              title="Open in browser"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" size="sm" disabled={loading} onClick={generate}>
            Regenerate
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Properties Dialog ─────────────────────────────────────────────────────────

interface PropertiesDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  object: S3Object | null
  providerId: string
  bucket: string
}

export function PropertiesDialog({
  open, onOpenChange, object, providerId, bucket
}: PropertiesDialogProps) {
  const [metadata, setMetadata] = useState<ObjectMetadata | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && object && !object.isFolder) {
      setLoading(true)
      window.api.objects.metadata(providerId, bucket, object.key)
        .then(setMetadata)
        .finally(() => setLoading(false))
    } else {
      setMetadata(null)
    }
  }, [open, object])

  const rows: Array<{ label: string; value?: string | number }> = object ? [
    { label: 'Key', value: object.key },
    { label: 'Size', value: formatBytes(object.size) },
    { label: 'Last Modified', value: formatDate(object.lastModified) },
    { label: 'Content Type', value: metadata?.contentType || object.contentType },
    { label: 'ETag', value: metadata?.etag || object.etag },
    { label: 'Storage Class', value: metadata?.storageClass || object.storageClass },
    { label: 'Version ID', value: metadata?.versionId }
  ].filter((r) => r.value != null) : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Properties" size="md">
      <div className="space-y-3">
        {loading ? (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">Loading metadata…</div>
        ) : (
          <>
            <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] overflow-hidden">
              {rows.map((row) => (
                <div key={row.label} className="flex items-start px-3 py-2 gap-4">
                  <span className="text-xs text-[var(--text-muted)] w-28 shrink-0 pt-0.5">{row.label}</span>
                  <span className="text-xs text-[var(--text-primary)] font-mono break-all">{String(row.value)}</span>
                </div>
              ))}
            </div>

            {/* Custom metadata */}
            {metadata?.metadata && Object.keys(metadata.metadata).length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">Custom Metadata</p>
                <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] overflow-hidden">
                  {Object.entries(metadata.metadata).map(([k, v]) => (
                    <div key={k} className="flex items-start px-3 py-2 gap-4">
                      <span className="text-xs text-[var(--text-muted)] w-28 shrink-0">{k}</span>
                      <span className="text-xs text-[var(--text-primary)] font-mono break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div className="flex justify-end pt-2 border-t border-[var(--border)]">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </div>
    </Dialog>
  )
}
