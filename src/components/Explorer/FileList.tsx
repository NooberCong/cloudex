import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as ContextMenu from '@radix-ui/react-context-menu'
import {
  ChevronUp, ChevronDown, Loader2, AlertCircle,
  Download, Trash2, Copy, Scissors, ClipboardPaste,
  Pencil, Link, Info, FolderOpen, RefreshCw, FolderPlus
} from 'lucide-react'
import { cn, formatBytes, formatDate } from '../../lib/utils'
import { useExplorerStore } from '../../store/explorer'
import type { S3Object } from '../../types'
import { FileIcon } from './FileIcon'
import { useToast } from '../UI/Toast'

type ColumnDef = { key: 'name' | 'size' | 'lastModified'; label: string; align?: string }

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size', align: 'text-right' },
  { key: 'lastModified', label: 'Modified' }
]

const LIST_GRID = 'grid grid-cols-[minmax(0,1fr)_8rem_12rem] items-center gap-x-6'

interface FileListProps {
  onRename: (obj: S3Object) => void
  onDelete: (keys: string[]) => void
  onDownload: (obj: S3Object) => void
  onProperties: (obj: S3Object) => void
  onPresignedUrl: (obj: S3Object) => void
  onPaste: () => void
  onNewFolder: () => void
}

export function FileList({
  onRename, onDelete, onDownload, onProperties, onPresignedUrl, onPaste, onNewFolder
}: FileListProps) {
  const toast = useToast()
  const [openingKey, setOpeningKey] = useState<string | null>(null)
  const {
    loading, error, location, selectedKeys,
    sortField, sortDir, isTruncated, objects, viewMode,
    navigate, refresh, loadMore, selectKey, selectAll, clearSelection,
    setSort, setClipboard, clipboard
  } = useExplorerStore()

  const visibleObjects = useMemo(() => {
    return [...objects].sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1

      let cmp = 0
      if (sortField === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortField === 'size') cmp = (a.size ?? 0) - (b.size ?? 0)
      else if (sortField === 'lastModified') cmp = (a.lastModified?.getTime() ?? 0) - (b.lastModified?.getTime() ?? 0)

      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [objects, sortField, sortDir])

  const hasVisibleObjects = visibleObjects.length > 0
  const cutKeys = useMemo(() => {
    if (!location || !clipboard || clipboard.action !== 'move') return new Set<string>()
    if (
      clipboard.location.providerId !== location.providerId ||
      clipboard.location.bucket !== location.bucket
    ) {
      return new Set<string>()
    }
    return new Set(clipboard.keys)
  }, [location, clipboard])

  const containerRef = useRef<HTMLDivElement>(null)
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const tryLoadMore = useCallback(async () => {
    if (!isTruncated || loading || !!error) return
    if (loadingMoreRef.current) return
    loadingMoreRef.current = true
    setIsLoadingMore(true)
    try {
      await loadMore()
    } finally {
      loadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [isTruncated, loading, error, loadMore])

  useEffect(() => {
    const root = containerRef.current
    const target = loadMoreSentinelRef.current
    if (!root || !target) return
    if (!isTruncated || loading || !!error) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          void tryLoadMore()
        }
      },
      { root, rootMargin: '200px 0px 200px 0px', threshold: 0.01 }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [isTruncated, loading, error, tryLoadMore, visibleObjects.length, viewMode])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!location) return
      const target = e.target as HTMLElement | null
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        selectAll()
      } else if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey) && !isTyping) {
        if (selectedKeys.length > 0) {
          e.preventDefault()
          setClipboard('copy', [...selectedKeys])
        }
      } else if ((e.key === 'x' || e.key === 'X') && (e.ctrlKey || e.metaKey) && !isTyping) {
        if (selectedKeys.length > 0) {
          e.preventDefault()
          setClipboard('move', [...selectedKeys])
        }
      } else if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey) && !isTyping) {
        if (clipboard) {
          e.preventDefault()
          onPaste()
        }
      } else if (
        e.key === 'Delete' ||
        e.key === 'Backspace' ||
        ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey))
      ) {
        if (e.key === 'Backspace' && target?.tagName === 'INPUT') return
        if ((e.key === 'd' || e.key === 'D') && isTyping) return
        if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey)) e.preventDefault()
        if (selectedKeys.length > 0) onDelete([...selectedKeys])
      } else if (e.key === 'F5' || (e.key === 'r' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault()
        refresh()
      } else if (e.key === 'Escape') {
        clearSelection()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [location, selectedKeys, clipboard, onPaste, onDelete, refresh, clearSelection, selectAll, setClipboard])

  const handleRowClick = useCallback((key: string, e: React.MouseEvent) => {
    selectKey(key, e.ctrlKey || e.metaKey, e.shiftKey)
  }, [selectKey])

  const handleRowDoubleClick = useCallback(async (obj: S3Object) => {
    if (!location) return
    if (obj.isFolder) {
      navigate({ ...location, prefix: obj.key })
      return
    }
    if (openingKey) return

    try {
      setOpeningKey(obj.key)
      await window.api.objects.open(location.providerId, location.bucket, obj.key)
    } catch (e: any) {
      toast.error(`Failed to open ${obj.name}`, e?.message || String(e))
    } finally {
      setOpeningKey(null)
    }
  }, [navigate, location, toast, openingKey])

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />
  }

  if (!location) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
        <FolderOpen className="w-14 h-14 text-[var(--text-muted)] opacity-40" />
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">No bucket selected</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Select a bucket from the sidebar to browse files</p>
        </div>
      </div>
    )
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          ref={containerRef}
          className="flex-1 flex flex-col overflow-y-auto"
          onScroll={(e) => {
            if (!isTruncated || loading || error) return
            const el = e.currentTarget
            const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
            if (distanceToBottom < 160) void tryLoadMore()
          }}
          onClick={(e) => {
            if (e.target === containerRef.current) clearSelection()
          }}
        >
          {viewMode === 'list' && (
            <div className={cn(
              'sticky top-0 z-10 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0',
              LIST_GRID
            )}>
              {COLUMNS.map((col) => (
                <button
                  key={col.key}
                  onClick={() => setSort(col.key)}
                  className={cn(
                    'flex items-center text-xs font-medium text-[var(--text-secondary)]',
                    'hover:text-[var(--text-primary)] transition-colors select-none',
                    col.key === 'name' ? 'min-w-0' : (col.align === 'text-right' ? 'justify-end' : 'justify-start'),
                    col.align
                  )}
                >
                  {col.label}
                  <SortIcon field={col.key} />
                </button>
              ))}
            </div>
          )}

          {loading && !hasVisibleObjects && (
            <div className="flex items-center justify-center flex-1 gap-2 text-[var(--text-muted)]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <AlertCircle className="w-10 h-10 text-[var(--danger)] opacity-60" />
              <p className="text-sm text-[var(--text-secondary)]">{error}</p>
              <button
                onClick={refresh}
                className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:underline"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}

          {!loading && !error && !hasVisibleObjects && (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
              <FolderOpen className="w-12 h-12 text-[var(--text-muted)] opacity-30" />
              <p className="text-sm text-[var(--text-muted)]">This folder is empty</p>
            </div>
          )}

          {!error && hasVisibleObjects && (
            <div className={cn('relative', viewMode === 'grid' && 'p-2')}>
              {loading && (
                <div className="absolute inset-0 z-20 pointer-events-auto cursor-progress">
                  <div className="absolute inset-0 bg-[var(--bg-primary)]/30 backdrop-blur-[1px]" />
                  <div className="absolute top-2 right-3 flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] px-2 py-1 text-[11px] text-[var(--text-secondary)] shadow-sm">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Refreshing...
                  </div>
                </div>
              )}

              <div className={cn(viewMode === 'grid' && 'grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5')}>
                {visibleObjects.map((obj) => {
                  const isSelected = selectedKeys.includes(obj.key)
                  const isOpening = openingKey === obj.key
                  const isCut = cutKeys.has(obj.key)

                  return (
                    <ContextMenu.Root key={obj.key}>
                      <ContextMenu.Trigger asChild>
                        <div
                          className={cn(
                            'cursor-default select-none transition-colors duration-75',
                              viewMode === 'list'
                                ? `px-4 py-1.5 border-b border-[var(--border)] border-opacity-50 ${LIST_GRID}`
                                : 'rounded-lg border border-[var(--border)] px-2 py-1.5 min-h-[76px] flex flex-col gap-1.5',
                            isCut && 'opacity-50',
                            isSelected ? 'bg-[var(--bg-selected)]' : 'hover:bg-[var(--bg-hover)]'
                          )}
                          onClick={(e) => handleRowClick(obj.key, e)}
                          onContextMenu={() => {
                            if (!selectedKeys.includes(obj.key)) selectKey(obj.key, false, false)
                          }}
                          onDoubleClick={() => handleRowDoubleClick(obj)}
                        >
                          {viewMode === 'list' ? (
                            <>
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                {isOpening ? (
                                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-[var(--accent)]" />
                                ) : (
                                  <FileIcon name={obj.name} isFolder={obj.isFolder} />
                                )}
                                <span className="text-sm truncate text-[var(--text-primary)]" title={obj.name}>{obj.name}</span>
                              </div>
                              <div className="text-right text-xs text-[var(--text-muted)] tabular-nums">
                                {obj.isFolder ? '-' : formatBytes(obj.size)}
                              </div>
                              <div className="text-xs text-[var(--text-muted)] tabular-nums truncate">
                                {obj.isFolder ? '-' : formatDate(obj.lastModified)}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 min-w-0">
                                {isOpening ? (
                                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-[var(--accent)]" />
                                ) : (
                                  <FileIcon name={obj.name} isFolder={obj.isFolder} />
                                )}
                                <span className="text-xs truncate text-[var(--text-primary)]" title={obj.name}>{obj.name}</span>
                              </div>
                              <div className="mt-auto flex items-center justify-between gap-1.5 text-[11px] text-[var(--text-muted)]">
                                <span className="truncate">{obj.isFolder ? 'Folder' : formatBytes(obj.size)}</span>
                                <span className="truncate tabular-nums">{obj.isFolder ? '-' : formatDate(obj.lastModified)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </ContextMenu.Trigger>

                      <ContextMenu.Portal>
                        <ContextMenu.Content
                          className={cn(
                            'min-w-[180px] py-1 rounded-xl border shadow-xl',
                            'bg-[var(--bg-primary)] border-[var(--border)]',
                            'animate-fade-in z-50'
                          )}
                        >
                          {!obj.isFolder && (
                            <ContextMenuItem
                              icon={<Download className="w-3.5 h-3.5" />}
                              label="Download"
                              onClick={() => onDownload(obj)}
                            />
                          )}
                          <ContextMenuItem
                            icon={<Copy className="w-3.5 h-3.5" />}
                            label="Copy"
                            onClick={() => {
                              const keys = selectedKeys.includes(obj.key) ? [...selectedKeys] : [obj.key]
                              setClipboard('copy', keys)
                            }}
                          />
                          <ContextMenuItem
                            icon={<Scissors className="w-3.5 h-3.5" />}
                            label="Cut"
                            onClick={() => {
                              const keys = selectedKeys.includes(obj.key) ? [...selectedKeys] : [obj.key]
                              setClipboard('move', keys)
                            }}
                          />
                          {clipboard && (
                            <ContextMenuItem
                              icon={<ClipboardPaste className="w-3.5 h-3.5" />}
                              label="Paste"
                              onClick={onPaste}
                            />
                          )}
                          <ContextMenu.Separator className="my-1 border-t border-[var(--border)]" />
                          <ContextMenuItem icon={<Pencil className="w-3.5 h-3.5" />} label="Rename" onClick={() => onRename(obj)} />
                          {!obj.isFolder && (
                            <ContextMenuItem
                              icon={<Link className="w-3.5 h-3.5" />}
                              label="Get Presigned URL"
                              onClick={() => onPresignedUrl(obj)}
                            />
                          )}
                          <ContextMenuItem icon={<Info className="w-3.5 h-3.5" />} label="Properties" onClick={() => onProperties(obj)} />
                          <ContextMenu.Separator className="my-1 border-t border-[var(--border)]" />
                          <ContextMenuItem
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                            label={selectedKeys.length > 1 && selectedKeys.includes(obj.key)
                              ? `Delete ${selectedKeys.length} items`
                              : 'Delete'}
                            danger
                            onClick={() => {
                              const keys = selectedKeys.includes(obj.key) ? [...selectedKeys] : [obj.key]
                              onDelete(keys)
                            }}
                          />
                        </ContextMenu.Content>
                      </ContextMenu.Portal>
                    </ContextMenu.Root>
                  )
                })}
              </div>

              {isLoadingMore && (
                <div className="w-full py-2 text-xs text-[var(--text-muted)] flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading more...
                </div>
              )}
              <div ref={loadMoreSentinelRef} className="h-1 w-full" />
            </div>
          )}
        </div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content
          className={cn(
            'min-w-[180px] py-1 rounded-xl border shadow-xl',
            'bg-[var(--bg-primary)] border-[var(--border)]',
            'animate-fade-in z-50'
          )}
        >
          <ContextMenuItem
            icon={<Copy className="w-3.5 h-3.5" />}
            label="Copy"
            disabled={selectedKeys.length === 0}
            onClick={() => {
              if (selectedKeys.length > 0) setClipboard('copy', [...selectedKeys])
            }}
          />
          <ContextMenuItem
            icon={<Scissors className="w-3.5 h-3.5" />}
            label="Cut"
            disabled={selectedKeys.length === 0}
            onClick={() => {
              if (selectedKeys.length > 0) setClipboard('move', [...selectedKeys])
            }}
          />
          <ContextMenu.Separator className="my-1 border-t border-[var(--border)]" />
          <ContextMenuItem
            icon={<FolderPlus className="w-3.5 h-3.5" />}
            label="New Folder"
            disabled={!location}
            onClick={onNewFolder}
          />
          <ContextMenuItem
            icon={<ClipboardPaste className="w-3.5 h-3.5" />}
            label="Paste"
            disabled={!clipboard}
            onClick={onPaste}
          />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

function ContextMenuItem({
  icon,
  label,
  danger = false,
  onClick,
  disabled = false
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <ContextMenu.Item
      onSelect={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2.5 px-3 py-1.5 text-xs cursor-default outline-none',
        'transition-colors rounded-sm mx-1',
        danger
          ? 'text-[var(--danger)] hover:bg-[var(--danger-light)]'
          : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      {icon}
      {label}
    </ContextMenu.Item>
  )
}
