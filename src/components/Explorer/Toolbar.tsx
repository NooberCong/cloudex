import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Upload, Download, Trash2, FolderPlus, RefreshCw,
  Search, X, LayoutList, LayoutGrid, ArrowLeft, ArrowRight, Copy, Scissors, ClipboardPaste
} from 'lucide-react'
import { Button } from '../UI/Button'
import { useExplorerStore } from '../../store/explorer'

interface ToolbarProps {
  onUploadFiles: () => void
  onUploadFolder: () => void
  onDownload: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onDelete: () => void
  onNewFolder: () => void
}

export function Toolbar({
  onUploadFiles,
  onUploadFolder,
  onDownload,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onNewFolder
}: ToolbarProps) {
  const {
    location, loading, selectedKeys, searchQuery, clipboard,
    backStack, forwardStack, viewMode, setSearch, setViewMode,
    refresh, navigate, navigateBack, navigateForward
  } = useExplorerStore()

  const searchRef = useRef<HTMLInputElement>(null)
  const [searchInput, setSearchInput] = useState(searchQuery)
  const hasSelection = selectedKeys.length > 0
  const canGoUp = location && location.prefix !== ''
  const canGoBack = backStack.length > 0
  const canGoForward = forwardStack.length > 0

  const goUp = useCallback(() => {
    if (!location || !canGoUp) return
    const parts = location.prefix.split('/').filter(Boolean)
    parts.pop()
    navigate({ ...location, prefix: parts.length ? parts.join('/') + '/' : '' })
  }, [location, canGoUp, navigate])

  const goBack = useCallback(() => {
    if (canGoBack) {
      void navigateBack()
      return
    }
    goUp()
  }, [canGoBack, navigateBack, goUp])

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault()
        goBack()
      } else if (e.button === 4 && canGoForward) {
        e.preventDefault()
        void navigateForward()
      }
    }
    window.addEventListener('mouseup', onMouseUp, { capture: true })
    return () => window.removeEventListener('mouseup', onMouseUp, { capture: true })
  }, [goBack, canGoForward, navigateForward])

  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchQuery) {
        void setSearch(searchInput)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, searchQuery, setSearch])

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border)] shrink-0 drag-region"
      style={{ height: 'var(--titlebar-height)' }}>
      <Button
        variant="ghost"
        size="sm"
        icon={<ArrowLeft className="w-3.5 h-3.5" />}
        onClick={goBack}
        disabled={!canGoBack && !canGoUp}
        className="no-drag"
        title="Back"
      />
      <Button
        variant="ghost"
        size="sm"
        icon={<ArrowRight className="w-3.5 h-3.5" />}
        onClick={() => void navigateForward()}
        disabled={!canGoForward}
        className="no-drag"
        title="Forward"
      />

      <div className="w-px h-4 bg-[var(--border)] mx-0.5" />

      <Button
        variant="primary"
        size="sm"
        icon={<Upload className="w-3.5 h-3.5" />}
        onClick={onUploadFiles}
        disabled={!location}
        className="no-drag"
        title="Upload files"
      >
        Files
      </Button>
      <Button
        variant="ghost"
        size="sm"
        icon={<Upload className="w-3.5 h-3.5" />}
        onClick={onUploadFolder}
        disabled={!location}
        className="no-drag"
        title="Upload folder"
      >
        Folder
      </Button>

      <Button
        variant="ghost"
        size="sm"
        icon={<Download className="w-3.5 h-3.5" />}
        onClick={onDownload}
        disabled={!hasSelection}
        className="no-drag"
        title="Download selected"
      />
      <Button
        variant="ghost"
        size="sm"
        icon={<Copy className="w-3.5 h-3.5" />}
        onClick={onCopy}
        disabled={!hasSelection}
        className="no-drag"
        title="Copy selected"
      />
      <Button
        variant="ghost"
        size="sm"
        icon={<Scissors className="w-3.5 h-3.5" />}
        onClick={onCut}
        disabled={!hasSelection}
        className="no-drag"
        title="Cut selected"
      />
      <Button
        variant="ghost"
        size="sm"
        icon={<ClipboardPaste className="w-3.5 h-3.5" />}
        onClick={onPaste}
        disabled={!clipboard || !location}
        className="no-drag"
        title="Paste"
      />

      <Button
        variant="ghost"
        size="sm"
        icon={<FolderPlus className="w-3.5 h-3.5" />}
        onClick={onNewFolder}
        disabled={!location}
        className="no-drag"
        title="New folder"
      />

      <Button
        variant="ghost"
        size="sm"
        icon={<Trash2 className="w-3.5 h-3.5 text-[var(--danger)]" />}
        onClick={onDelete}
        disabled={!hasSelection}
        className="no-drag"
        title="Delete selected (Delete / Ctrl+D)"
      />

      <div className="w-px h-4 bg-[var(--border)] mx-0.5" />

      <Button
        variant="ghost"
        size="sm"
        icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
        onClick={refresh}
        disabled={!location || loading}
        className="no-drag"
        title="Refresh (Ctrl+R)"
      />

      <div className="flex-1" />

      <div className="relative no-drag flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-7 pl-8 pr-7 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] w-48 focus:w-64 transition-all"
          style={{ userSelect: 'auto' }}
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput('')
              void setSearch('')
            }}
            className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="w-px h-4 bg-[var(--border)] mx-0.5" />

      <div className="flex no-drag">
        <Button
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          size="sm"
          icon={<LayoutList className="w-3.5 h-3.5" />}
          onClick={() => setViewMode('list')}
          title="List view"
        />
        <Button
          variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
          size="sm"
          icon={<LayoutGrid className="w-3.5 h-3.5" />}
          onClick={() => setViewMode('grid')}
          title="Grid view"
        />
      </div>
    </div>
  )
}
