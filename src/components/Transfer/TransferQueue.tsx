import React from 'react'
import { X, ChevronDown, ChevronUp, CheckCircle, XCircle, Upload, Download } from 'lucide-react'
import { cn, formatBytes, formatSpeed, formatEta } from '../../lib/utils'
import { useTransfersStore } from '../../store/transfers'
import type { TransferItem } from '../../types'

export function TransferQueue() {
  const { transfers, isQueueOpen, toggleQueue, removeTransfer, clearCompleted } = useTransfersStore()

  const active = transfers.filter((t) => t.status === 'active' || t.status === 'queued')
  const done = transfers.filter((t) => t.status === 'done' || t.status === 'error')
  const total = transfers.length

  if (total === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'w-96 max-w-[calc(100vw-2rem)] bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl shadow-2xl',
        'animate-slide-up overflow-hidden'
      )}
    >
      <div
        className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--border)] cursor-pointer"
        onClick={toggleQueue}
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-[var(--text-primary)]">Transfers</span>
          {active.length > 0 && (
            <span className="text-xs bg-[var(--accent)] text-white px-1.5 py-0.5 rounded-full">
              {active.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {done.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); clearCompleted() }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Clear
            </button>
          )}
          {isQueueOpen ? <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />}
        </div>
      </div>

      {isQueueOpen && (
        <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
          {transfers.map((t) => (
            <TransferItemRow key={t.id} item={t} onRemove={() => removeTransfer(t.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TransferItemRow({ item, onRemove }: { item: TransferItem; onRemove: () => void }) {
  const pct = item.totalBytes > 0
    ? Math.round((item.transferredBytes / item.totalBytes) * 100)
    : 0

  return (
    <div className="px-4 py-3.5 group">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          {item.direction === 'upload' ? (
            <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
          ) : (
            <Download className="w-3.5 h-3.5 text-[var(--success)]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">{item.fileName}</span>
            <div className="flex items-center gap-1 shrink-0">
              {item.status === 'done' && <CheckCircle className="w-3.5 h-3.5 text-[var(--success)]" />}
              {item.status === 'error' && <XCircle className="w-3.5 h-3.5 text-[var(--danger)]" />}
              <button
                onClick={onRemove}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {item.status === 'active' && (
            <>
              <div className="mt-2 h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-[var(--text-secondary)]">
                  {formatBytes(item.transferredBytes)} / {formatBytes(item.totalBytes)} - {pct}%
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {formatSpeed(item.speed)} {item.eta ? `- ${formatEta(item.eta)} left` : ''}
                </span>
              </div>
            </>
          )}

          {item.status === 'done' && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--success)]">
                {item.direction === 'upload' ? 'Uploaded' : 'Downloaded'} - {formatBytes(item.totalBytes)}
              </span>
              {item.direction === 'download' && (
                <button
                  onClick={() => { void window.api.shell.showInFolder(item.localPath) }}
                  className="text-xs font-medium text-[var(--accent)] hover:underline"
                >
                  Show in Explorer
                </button>
              )}
            </div>
          )}

          {item.status === 'error' && (
            <span className="text-xs text-[var(--danger)] truncate block">
              {item.error || 'Transfer failed'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
