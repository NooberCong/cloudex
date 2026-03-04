import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { Toolbar } from './components/Explorer/Toolbar'
import { BreadCrumb } from './components/Explorer/BreadCrumb'
import { FileList } from './components/Explorer/FileList'
import { TransferQueue } from './components/Transfer/TransferQueue'
import { AddProviderDialog } from './components/Dialogs/AddProviderDialog'
import {
  DeleteDialog, RenameDialog, NewFolderDialog,
  PresignedUrlDialog, PropertiesDialog, UploadConflictDialog, ProviderDeleteDialog,
  RenameConflictDialog
} from './components/Dialogs/OperationDialogs'
import { SettingsPage } from './components/Settings/SettingsPage'
import { useExplorerStore } from './store/explorer'
import { useTransfersStore } from './store/transfers'
import { useProvidersStore } from './store/providers'
import { generateId } from './lib/utils'
import { useToast } from './components/UI/Toast'
import { Loader2 } from 'lucide-react'
import type { S3Object, ProviderConfig, Theme } from './types'

function keyToDisplayName(key: string): string {
  const trimmed = key.endsWith('/') ? key.slice(0, -1) : key
  const leaf = trimmed.split('/').pop() || trimmed
  return key.endsWith('/') ? `${leaf}/` : leaf
}

function formatItemsDescription(items: string[], maxItems = 5): string {
  if (items.length === 0) return ''
  const unique = [...new Set(items.filter(Boolean))]
  const shown = unique.slice(0, maxItems)
  const remaining = unique.length - shown.length
  return remaining > 0 ? `${shown.join(', ')} +${remaining} more` : shown.join(', ')
}

export function App() {
  type UploadConflictChoice = 'overwrite' | 'skip' | 'cancel'
  const toast = useToast()
  const {
    location, refresh, clearSelection, selectedKeys,
    clipboard, clearClipboard, setClipboard, pruneHistoryPaths
  } =
    useExplorerStore()
  const { addTransfer, updateProgress, completeTransfer, errorTransfer } = useTransfersStore()
  const deleteProvider = useProvidersStore((s) => s.deleteProvider)

  // ── Page view state ─────────────────────────────────────────────────────────
  const [view, setView] = useState<'explorer' | 'settings'>('explorer')

  // ── Theme ───────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    if (window.api) {
      window.api.prefs.get().then((p) => setTheme(p.theme)).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const apply = (t: Theme) => {
      const isDark =
        t === 'dark' ||
        (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', isDark)
    }
    apply(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => { if (theme === 'system') apply('system') }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const handleThemeChange = (t: Theme) => {
    setTheme(t)
    window.api.prefs.save({ theme: t }).catch(() => {})
  }

  const folderUploadGroupsRef = useRef(new Map<string, {
    childIds: Set<string>
    completedIds: Set<string>
    hasError: boolean
  }>())
  const childToFolderGroupRef = useRef(new Map<string, string>())

  const refreshFolderGroupProgress = useCallback((groupId: string) => {
    const group = folderUploadGroupsRef.current.get(groupId)
    if (!group) return
    updateProgress(groupId, group.completedIds.size, group.childIds.size)
  }, [updateProgress])

  const markFolderGroupChildFinished = useCallback((childTransferId: string, errorMessage?: string) => {
    const groupId = childToFolderGroupRef.current.get(childTransferId)
    if (!groupId) return
    const group = folderUploadGroupsRef.current.get(groupId)
    if (!group) return

    if (group.completedIds.has(childTransferId)) return
    if (errorMessage) group.hasError = true
    group.completedIds.add(childTransferId)
    refreshFolderGroupProgress(groupId)

    if (group.completedIds.size >= group.childIds.size) {
      if (group.hasError) {
        errorTransfer(groupId, 'Some files in this folder failed')
      } else {
        completeTransfer(groupId)
      }
      for (const childId of group.childIds) {
        childToFolderGroupRef.current.delete(childId)
      }
      folderUploadGroupsRef.current.delete(groupId)
    }
  }, [completeTransfer, errorTransfer, refreshFolderGroupProgress])

  // ── Transfer IPC listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubProgress = window.api.transfer.onProgress(({ transferId, transferredBytes, totalBytes }) => {
      updateProgress(transferId, transferredBytes, totalBytes)
    })
    const unsubComplete = window.api.transfer.onComplete(({ transferId }) => {
      completeTransfer(transferId)
      markFolderGroupChildFinished(transferId)
      refresh()
    })
    const unsubError = window.api.transfer.onError(({ transferId, error }) => {
      errorTransfer(transferId, error)
      markFolderGroupChildFinished(transferId, error)
    })
    return () => {
      unsubProgress()
      unsubComplete()
      unsubError()
    }
  }, [updateProgress, completeTransfer, refresh, errorTransfer, refreshFolderGroupProgress, markFolderGroupChildFinished])

  // ── Add provider dialog ──────────────────────────────────────────────────────
  const [addProviderOpen, setAddProviderOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null)
  const [providerDeleteOpen, setProviderDeleteOpen] = useState(false)
  const [providerDeleteTarget, setProviderDeleteTarget] = useState<ProviderConfig | null>(null)
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(null)

  const openAddProvider = () => {
    setEditingProvider(null)
    setAddProviderOpen(true)
  }
  const openEditProvider = (p: ProviderConfig) => {
    setEditingProvider(p)
    setAddProviderOpen(true)
  }

  const handleDeleteProviderRequest = (provider: ProviderConfig) => {
    setProviderDeleteTarget(provider)
    setProviderDeleteOpen(true)
  }

  const handleDeleteProviderConfirm = async () => {
    if (!providerDeleteTarget) return
    setDeletingProviderId(providerDeleteTarget.id)
    try {
      await deleteProvider(providerDeleteTarget.id)
      toast.success('Provider removed')
    } catch (e: any) {
      toast.error('Failed to remove provider', e?.message)
    } finally {
      setDeletingProviderId(null)
    }
  }

  // ── Delete dialog ────────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteKeys, setDeleteKeys] = useState<string[]>([])

  const handleDeleteRequest = (keys: string[]) => {
    setDeleteKeys(keys)
    setDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!location) return
    await window.api.objects.delete(location.providerId, location.bucket, deleteKeys)
    const removedFolderPrefixes = deleteKeys.filter((k) => k.endsWith('/'))
    if (removedFolderPrefixes.length > 0) {
      pruneHistoryPaths(location.providerId, location.bucket, removedFolderPrefixes)
    }
    toast.success(
      `Deleted ${deleteKeys.length} item${deleteKeys.length > 1 ? 's' : ''}`,
      formatItemsDescription(deleteKeys.map(keyToDisplayName))
    )
    clearSelection()
    refresh()
  }

  // ── Rename dialog ────────────────────────────────────────────────────────────
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<S3Object | null>(null)
  const [renameConflict, setRenameConflict] = useState<{
    target: S3Object
    destKey: string
  } | null>(null)

  const executeRename = useCallback(async (target: S3Object, destKey: string) => {
    if (!location) return
    await window.api.objects.rename(
      location.providerId,
      location.bucket,
      target.key,
      destKey
    )
    if (target.isFolder) {
      pruneHistoryPaths(location.providerId, location.bucket, [target.key])
    }
    toast.success('Renamed successfully')
    refresh()
  }, [location, pruneHistoryPaths, refresh, toast])

  const handleRenameConfirm = async (newName: string) => {
    if (!location || !renameTarget) return
    const currentName = renameTarget.isFolder
      ? renameTarget.name.replace(/\/$/, '')
      : renameTarget.name
    if (newName === currentName) return

    const sourceKey = renameTarget.isFolder
      ? renameTarget.key.replace(/\/$/, '')
      : renameTarget.key
    const parts = sourceKey.split('/')
    parts[parts.length - 1] = newName
    const newKey = renameTarget.isFolder ? `${parts.join('/')}/` : parts.join('/')

    let destinationExists = false
    if (renameTarget.isFolder) {
      destinationExists = await window.api.objects.exists(location.providerId, location.bucket, newKey)
      if (!destinationExists) {
        const listed = await window.api.objects.list(location.providerId, location.bucket, newKey)
        destinationExists = listed.objects.length > 0 || listed.prefixes.length > 0
      }
    } else {
      destinationExists = await objectExists(location.providerId, location.bucket, newKey)
    }

    if (destinationExists) {
      setRenameConflict({ target: renameTarget, destKey: newKey })
      return
    }

    await executeRename(renameTarget, newKey)
  }

  // ── New folder dialog ────────────────────────────────────────────────────────
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderConflictPath, setNewFolderConflictPath] = useState<string | null>(null)

  const handleNewFolderConfirm = async (name: string) => {
    if (!location) return
    const prefix = location.prefix + name
    const fileExists = await objectExists(location.providerId, location.bucket, prefix)
    const folderKey = `${prefix}/`
    let folderExists = await window.api.objects.exists(location.providerId, location.bucket, folderKey)
    if (!folderExists) {
      const listed = await window.api.objects.list(location.providerId, location.bucket, folderKey)
      folderExists = listed.objects.length > 0 || listed.prefixes.length > 0
    }

    if (fileExists || folderExists) {
      setNewFolderConflictPath(folderKey)
      return
    }
    await window.api.objects.createFolder(location.providerId, location.bucket, prefix)
    toast.success(`Folder "${name}" created`)
    refresh()
  }

  // ── Presigned URL dialog ─────────────────────────────────────────────────────
  const [presignOpen, setPresignOpen] = useState(false)
  const [presignTarget, setPresignTarget] = useState<S3Object | null>(null)

  // ── Properties dialog ────────────────────────────────────────────────────────
  const [propsOpen, setPropsOpen] = useState(false)
  const [propsTarget, setPropsTarget] = useState<S3Object | null>(null)
  const [uploadConflict, setUploadConflict] = useState<{
    path: string
    resolve: (choice: UploadConflictChoice) => void
  } | null>(null)
  const [clipboardExpanded, setClipboardExpanded] = useState(false)
  const [clipboardBusy, setClipboardBusy] = useState<{
    action: 'paste' | 'move'
    count: number
  } | null>(null)

  const requestUploadConflict = useCallback((path: string) => {
    return new Promise<UploadConflictChoice>((resolve) => {
      setUploadConflict({ path, resolve })
    })
  }, [])

  const resolveUploadConflict = useCallback((choice: UploadConflictChoice) => {
    setUploadConflict((curr) => {
      if (curr) curr.resolve(choice)
      return null
    })
  }, [])

  useEffect(() => {
    setClipboardExpanded(false)
  }, [clipboard?.action, clipboard?.keys.join('|'), clipboard?.location.providerId, clipboard?.location.bucket, clipboard?.location.prefix])

  const uploadFromPaths = useCallback(async (filePaths: string[]) => {
    if (!location) return

    let uploadEntries: Array<{ filePath: string; relativePath: string }> = []
    try {
      uploadEntries = await window.api.files.expandForUpload(filePaths)
    } catch (e: any) {
      toast.error('Upload failed', e?.message || String(e))
      return
    }
    if (uploadEntries.length === 0) {
      toast.error('Upload failed', 'No files found in dropped selection.')
      return
    }

    let skippedConflicts = 0
    let canceledByUser = false
    const folderGroupByRoot = new Map<string, string>()

    const ensureFolderGroupTransfer = (relativePath: string): string | undefined => {
      const parts = relativePath.split('/').filter(Boolean)
      if (parts.length <= 1) return undefined
      const rootFolder = parts[0]
      const existingGroupId = folderGroupByRoot.get(rootFolder)
      if (existingGroupId) return existingGroupId

      const groupId = generateId()
      folderGroupByRoot.set(rootFolder, groupId)
      folderUploadGroupsRef.current.set(groupId, {
        childIds: new Set<string>(),
        completedIds: new Set<string>(),
        hasError: false
      })
      addTransfer({
        id: groupId,
        direction: 'upload',
        isGroup: true,
        providerId: location.providerId,
        bucket: location.bucket,
        key: location.prefix + `${rootFolder}/`,
        localPath: rootFolder,
        fileName: `${rootFolder}/`,
        completedItems: 0,
        totalItems: 0,
        totalBytes: 0
      })
      return groupId
    }

    for (const entry of uploadEntries) {
      const filePath = entry.filePath
      const relativePath = entry.relativePath.replace(/\\/g, '/')
      const fileName = relativePath.split('/').pop() || relativePath
      const key = location.prefix + relativePath

      try {
        const exists = await window.api.objects.exists(location.providerId, location.bucket, key)
        if (!exists) {
          throw new Error('NotFound')
        }
        const choice = await requestUploadConflict(relativePath)
        if (choice === 'cancel') {
          canceledByUser = true
          break
        }
        if (choice === 'skip') {
          skippedConflicts++
          continue
        }
      } catch {
        // Not found or metadata unavailable; proceed with upload.
      }

      const transferId = generateId()
      const groupId = ensureFolderGroupTransfer(relativePath)

      if (groupId) {
        const group = folderUploadGroupsRef.current.get(groupId)
        if (group) {
          group.childIds.add(transferId)
          childToFolderGroupRef.current.set(transferId, groupId)
          refreshFolderGroupProgress(groupId)
        }
      }

      addTransfer({
        id: transferId,
        direction: 'upload',
        parentTransferId: groupId,
        providerId: location.providerId,
        bucket: location.bucket,
        key,
        localPath: filePath,
        fileName,
        totalBytes: 0
      })

      window.api.transfer.upload({
        providerId: location.providerId,
        bucket: location.bucket,
        key,
        filePath,
        transferId
      }).catch((e) => {
        const message = e?.message || String(e)
        errorTransfer(transferId, message)
        markFolderGroupChildFinished(transferId, message)
        toast.error(`Upload failed: ${fileName}`, e?.message)
      })
    }

    if (skippedConflicts > 0) {
      toast.info(`Skipped ${skippedConflicts} existing file${skippedConflicts > 1 ? 's' : ''}`)
    }
    if (canceledByUser) {
      toast.info('Upload canceled')
    }
  }, [location, addTransfer, errorTransfer, toast, requestUploadConflict, markFolderGroupChildFinished])

  // ── Upload ───────────────────────────────────────────────────────────────────
  const handleUploadFiles = useCallback(async () => {
    if (!location) return
    const result = await window.api.dialog.openFile()
    if (result.canceled || result.filePaths.length === 0) return
    void uploadFromPaths(result.filePaths)
  }, [location, uploadFromPaths])

  const handleUploadFolder = useCallback(async () => {
    if (!location) return
    const result = await window.api.dialog.openDirectory({ title: 'Select folder to upload' })
    if (result.canceled || result.filePaths.length === 0) return
    void uploadFromPaths(result.filePaths)
  }, [location, uploadFromPaths])

  // ── Download ─────────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async (obj?: S3Object) => {
    if (!location) return
    const keys = obj ? [obj.key] : [...selectedKeys]
    if (keys.length === 0) return

    const shouldZip = keys.length > 1 || keys.some((k) => k.endsWith('/'))
    if (shouldZip) {
      const saveResult = await window.api.dialog.saveFile({
        title: 'Save zip archive',
        defaultPath: 'download.zip',
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }]
      })
      if (saveResult.canceled || !saveResult.filePath) return

      const transferId = generateId()
      const zipPath = saveResult.filePath
      const zipName = zipPath.split(/[\\/]/).pop() || 'download.zip'
      addTransfer({
        id: transferId,
        direction: 'download',
        providerId: location.providerId,
        bucket: location.bucket,
        key: `${location.prefix}*.zip`,
        localPath: zipPath,
        fileName: zipName,
        totalBytes: 0
      })

      window.api.transfer.downloadZip({
        providerId: location.providerId,
        bucket: location.bucket,
        prefix: location.prefix,
        keys,
        destPath: zipPath,
        transferId
      }).catch((e) => {
        errorTransfer(transferId, e?.message || String(e))
        toast.error('Zip download failed', e?.message)
      })
      return
    }

    // Choose download destination
    const dirResult = await window.api.dialog.openDirectory({ title: 'Choose download folder' })
    if (dirResult.canceled || !dirResult.filePaths[0]) return
    const destDir = dirResult.filePaths[0]

    for (const key of keys) {
      if (key.endsWith('/')) continue // skip folders
      const fileName = key.split('/').pop() || key
      const destPath = destDir + '/' + fileName
      const transferId = generateId()

      addTransfer({
        id: transferId,
        direction: 'download',
        providerId: location.providerId,
        bucket: location.bucket,
        key,
        localPath: destPath,
        fileName,
        totalBytes: 0
      })

      window.api.transfer.download({
        providerId: location.providerId,
        bucket: location.bucket,
        key,
        destPath,
        transferId
      }).catch((e) => {
        errorTransfer(transferId, e?.message || String(e))
        toast.error(`Download failed: ${fileName}`, e?.message)
      })
    }
  }, [location, selectedKeys, addTransfer, errorTransfer, toast])

  const objectExists = useCallback(async (
    providerId: string,
    bucket: string,
    key: string
  ): Promise<boolean> => {
    try {
      return await window.api.objects.exists(providerId, bucket, key)
    } catch (e: any) {
      const msg = String(e?.message || e || '').toLowerCase()
      if (
        msg.includes('notfound') ||
        msg.includes('blobnotfound') ||
        msg.includes('no such key') ||
        msg.includes('nosuchkey') ||
        msg.includes('"statuscode": 404') ||
        msg.includes('status code: 404') ||
        msg.includes('httpstatuscode: 404') ||
        msg.includes('not found')
      ) {
        return false
      }
      throw e
    }
  }, [])

  const resolveSameFolderCopyKey = useCallback(async (
    providerId: string,
    bucket: string,
    originalKey: string
  ): Promise<string> => {
    const isFolder = originalKey.endsWith('/')
    const trimmed = isFolder ? originalKey.slice(0, -1) : originalKey
    const leaf = trimmed.split('/').pop() || trimmed

    const lastDot = !isFolder ? leaf.lastIndexOf('.') : -1
    const fileBase = !isFolder && lastDot > 0 ? leaf.slice(0, lastDot) : leaf
    const fileExt = !isFolder && lastDot > 0 ? leaf.slice(lastDot) : ''
    const parentPrefix = originalKey.slice(0, originalKey.length - (isFolder ? (leaf.length + 1) : leaf.length))

    for (let i = 1; i <= 999; i++) {
      const suffix = i === 1 ? ' - Copy' : ` - Copy (${i})`
      const copiedName = isFolder
        ? `${leaf}${suffix}/`
        : `${fileBase}${suffix}${fileExt}`
      const candidate = parentPrefix + copiedName
      if (!(await objectExists(providerId, bucket, candidate))) {
        return candidate
      }
    }

    throw new Error('Unable to find an available copy name')
  }, [objectExists])

  // ── Paste (copy/move) ────────────────────────────────────────────────────────
  const handlePaste = useCallback(async () => {
    if (!location || !clipboard || clipboardBusy) return
    const { action, keys, location: src } = clipboard

    setClipboardBusy({ action: 'paste', count: keys.length })
    let changedCount = 0
    let skippedSameTarget = 0
    const changedItems: string[] = []
    try {
      for (const srcKey of keys) {
        const srcTrimmed = srcKey.endsWith('/') ? srcKey.slice(0, -1) : srcKey
        const leafName = srcTrimmed.split('/').pop() || srcTrimmed
        const fileName = srcKey.endsWith('/') ? `${leafName}/` : leafName
        let destKey = location.prefix + fileName
        const isSameTarget =
          src.providerId === location.providerId &&
          src.bucket === location.bucket &&
          srcKey === destKey

        if (isSameTarget) {
          if (action === 'copy') {
            destKey = await resolveSameFolderCopyKey(location.providerId, location.bucket, srcKey)
          } else {
            skippedSameTarget++
            continue
          }
        }

        try {
          await window.api.objects.copy({
            srcProviderId: src.providerId,
            srcBucket: src.bucket,
            srcKey,
            destProviderId: location.providerId,
            destBucket: location.bucket,
            destKey
          })
          if (action === 'move') {
            await window.api.objects.delete(src.providerId, src.bucket, [srcKey])
          }
          changedCount++
          changedItems.push(keyToDisplayName(srcKey))
        } catch (e: any) {
          toast.error(`Failed to ${action} ${fileName}`, e?.message)
        }
      }

      if (changedCount > 0) {
        toast.success(
          `${action === 'copy' ? 'Copied' : 'Moved'} ${changedCount} item${changedCount > 1 ? 's' : ''}`,
          formatItemsDescription(changedItems)
        )
        clearClipboard()
        refresh()
        return
      }

      if (skippedSameTarget > 0) {
        if (action === 'move') {
          clearClipboard()
          return
        } else {
          toast.info('Same location: nothing to paste')
          return
        }
      }
    } finally {
      setClipboardBusy(null)
    }
  }, [location, clipboard, toast, clearClipboard, refresh, resolveSameFolderCopyKey, clipboardBusy])

  const handleCopy = useCallback(() => {
    if (!location || selectedKeys.length === 0) return
    setClipboard('copy', [...selectedKeys])
  }, [location, selectedKeys, setClipboard])

  const handleCut = useCallback(() => {
    if (!location || selectedKeys.length === 0) return
    setClipboard('move', [...selectedKeys])
  }, [location, selectedKeys, setClipboard])

  const handleMoveToFolder = useCallback(async (keys: string[], targetFolderKey: string) => {
    if (!location || keys.length === 0 || clipboardBusy) return

    setClipboardBusy({ action: 'move', count: keys.length })
    let movedCount = 0
    const movedItems: string[] = []
    try {
      for (const srcKey of keys) {
        const srcTrimmed = srcKey.endsWith('/') ? srcKey.slice(0, -1) : srcKey
        const leafName = srcTrimmed.split('/').pop() || srcTrimmed
        const destKey = targetFolderKey + (srcKey.endsWith('/') ? `${leafName}/` : leafName)

        if (srcKey === destKey) continue
        if (srcKey.endsWith('/') && targetFolderKey.startsWith(srcKey)) {
          toast.error(`Failed to move ${leafName}`, 'Cannot move a folder into itself.')
          continue
        }

        try {
          await window.api.objects.copy({
            srcProviderId: location.providerId,
            srcBucket: location.bucket,
            srcKey,
            destProviderId: location.providerId,
            destBucket: location.bucket,
            destKey
          })
          await window.api.objects.delete(location.providerId, location.bucket, [srcKey])
          movedCount++
          movedItems.push(srcKey.endsWith('/') ? `${leafName}/` : leafName)
        } catch (e: any) {
          toast.error(`Failed to move ${leafName}`, e?.message)
        }
      }
      if (movedCount > 0) {
        toast.success(
          `Moved ${movedCount} item${movedCount > 1 ? 's' : ''}`,
          formatItemsDescription(movedItems)
        )
        refresh()
      }
    } finally {
      setClipboardBusy(null)
    }
  }, [location, toast, refresh, clipboardBusy])

  // ── Drag and drop upload ──────────────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const extractDroppedFilePaths = (dataTransfer: DataTransfer): string[] => {
    const pathSet = new Set<string>()

    for (const file of Array.from(dataTransfer.files)) {
      const p = (file as any).path || window.api.files.getPath(file)
      if (typeof p === 'string' && p) pathSet.add(p)
    }

    if (pathSet.size === 0) {
      const uriList = dataTransfer.getData('text/uri-list') || ''
      for (const raw of uriList.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith('#') || !line.toLowerCase().startsWith('file://')) continue
        let pathFromUri = decodeURIComponent(line.replace(/^file:\/\//i, ''))
        if (/^\/[a-zA-Z]:\//.test(pathFromUri)) {
          pathFromUri = pathFromUri.slice(1)
        }
        if (pathFromUri) pathSet.add(pathFromUri)
      }
    }

    return [...pathSet]
  }

  const isLikelyExternalFileDrop = (dataTransfer: DataTransfer): boolean => {
    const types = Array.from(dataTransfer.types || [])
    if (types.includes('Files')) return true
    const uriList = dataTransfer.getData('text/uri-list') || ''
    return uriList.split(/\r?\n/).some((raw) => raw.trim().toLowerCase().startsWith('file://'))
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    if (!location) return
    if (!isLikelyExternalFileDrop(e.dataTransfer)) return

    const filePaths = extractDroppedFilePaths(e.dataTransfer)
    if (filePaths.length === 0) {
      toast.error('Drop failed', 'Could not read local file path from dragged file.')
      return
    }

    void uploadFromPaths(filePaths)
  }, [location, uploadFromPaths, toast])

  useEffect(() => {
    const onWindowDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    const onWindowDrop = (e: DragEvent) => {
      if (e.defaultPrevented) return
      e.preventDefault()
      dragCounter.current = 0
      setIsDragging(false)
      if (!location || !e.dataTransfer) return
      if (!isLikelyExternalFileDrop(e.dataTransfer)) return

      const filePaths = extractDroppedFilePaths(e.dataTransfer)
      if (filePaths.length === 0) return
      void uploadFromPaths(filePaths)
    }

    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('drop', onWindowDrop)
    return () => {
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('drop', onWindowDrop)
    }
  }, [location, uploadFromPaths])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex h-full w-full overflow-hidden bg-[var(--bg-primary)]"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Sidebar */}
      <Sidebar
        onAddProvider={openAddProvider}
        onOpenSettings={() => setView('settings')}
        onOpenExplorer={() => setView('explorer')}
        onEditProvider={openEditProvider}
        onDeleteProvider={handleDeleteProviderRequest}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {view === 'settings' ? (
          <SettingsPage
            onClose={() => setView('explorer')}
            onEditProvider={openEditProvider}
            onAddProvider={openAddProvider}
            onDeleteProvider={handleDeleteProviderRequest}
            deletingProviderId={deletingProviderId}
            theme={theme}
            onThemeChange={handleThemeChange}
          />
        ) : (
          <>
            <Toolbar
              onUploadFiles={handleUploadFiles}
              onUploadFolder={handleUploadFolder}
              onDownload={() => handleDownload()}
              onCopy={handleCopy}
              onCut={handleCut}
              onPaste={handlePaste}
              onDelete={() => handleDeleteRequest([...selectedKeys])}
              onNewFolder={() => setNewFolderOpen(true)}
            />
            <BreadCrumb />
            <FileList
              onRename={(obj) => { setRenameTarget(obj); setRenameOpen(true) }}
              onDelete={handleDeleteRequest}
              onDownload={(obj) => handleDownload(obj)}
              onProperties={(obj) => { setPropsTarget(obj); setPropsOpen(true) }}
              onPresignedUrl={(obj) => { setPresignTarget(obj); setPresignOpen(true) }}
              onPaste={handlePaste}
              onNewFolder={() => setNewFolderOpen(true)}
              onMoveToFolder={handleMoveToFolder}
            />
            {clipboardBusy && (
              <div className="border-t border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-secondary)] flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                <span>
                  {clipboardBusy.action === 'paste' ? 'Applying paste' : 'Moving'} {clipboardBusy.count} item{clipboardBusy.count > 1 ? 's' : ''}...
                </span>
              </div>
            )}
            {clipboard && (
              <div className="border-t border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-[var(--text-secondary)]">
                    <div className="truncate">
                      {clipboard.action === 'copy' ? 'Copied' : 'Cut'} {clipboard.keys.length} item{clipboard.keys.length > 1 ? 's' : ''}
                    </div>
                    <div className="truncate text-[var(--text-primary)]">
                      {clipboard.keys.length === 1
                        ? `${clipboard.location.bucket}/${clipboard.keys[0]}`
                        : `${clipboard.location.bucket}/${clipboard.keys[0]} (+${clipboard.keys.length - 1} more)`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {clipboard.keys.length > 1 && (
                      <button
                        onClick={() => setClipboardExpanded((v) => !v)}
                        className="px-2 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        {clipboardExpanded ? 'Collapse' : 'Expand'}
                      </button>
                    )}
                    <button
                      onClick={clearClipboard}
                      disabled={!!clipboardBusy}
                      className="px-2 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {clipboardExpanded && clipboard.keys.length > 1 && (
                  <div className="mt-2 rounded border border-[var(--border)] bg-[var(--bg-primary)] max-h-40 overflow-auto">
                    {clipboard.keys.map((key) => (
                      <div
                        key={key}
                        className="px-2 py-1 border-b border-[var(--border)] last:border-b-0 text-[var(--text-primary)] truncate"
                        title={`${clipboard.location.bucket}/${key}`}
                      >
                        {clipboard.location.bucket}/{key}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Drag overlay */}
      {isDragging && location && (
        <div className="drop-overlay">
          <div className="text-center">
            <p className="text-lg font-semibold text-[var(--accent)]">Drop files to upload</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              to {location.bucket}/{location.prefix}
            </p>
          </div>
        </div>
      )}

      {/* Transfer queue */}
      <TransferQueue />

      {/* Dialogs */}
      <AddProviderDialog
        open={addProviderOpen}
        onOpenChange={setAddProviderOpen}
        editing={editingProvider}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        keys={deleteKeys}
        onConfirm={handleDeleteConfirm}
      />
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        object={renameTarget}
        onConfirm={handleRenameConfirm}
      />
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onConfirm={handleNewFolderConfirm}
      />
      <PresignedUrlDialog
        open={presignOpen}
        onOpenChange={setPresignOpen}
        object={presignTarget}
        providerId={location?.providerId || ''}
        bucket={location?.bucket || ''}
      />
      <PropertiesDialog
        open={propsOpen}
        onOpenChange={setPropsOpen}
        object={propsTarget}
        providerId={location?.providerId || ''}
        bucket={location?.bucket || ''}
      />
      <UploadConflictDialog
        open={!!uploadConflict}
        path={uploadConflict?.path || ''}
        onOverwrite={() => resolveUploadConflict('overwrite')}
        onSkip={() => resolveUploadConflict('skip')}
        onCancelUpload={() => resolveUploadConflict('cancel')}
      />
      <ProviderDeleteDialog
        open={providerDeleteOpen}
        onOpenChange={(open) => {
          setProviderDeleteOpen(open)
          if (!open) setProviderDeleteTarget(null)
        }}
        providerName={providerDeleteTarget?.name || ''}
        onConfirm={handleDeleteProviderConfirm}
      />
      <RenameConflictDialog
        open={!!renameConflict}
        path={renameConflict?.destKey || ''}
        onCancel={() => setRenameConflict(null)}
        onReplace={async () => {
          if (!renameConflict) return
          await executeRename(renameConflict.target, renameConflict.destKey)
          setRenameConflict(null)
        }}
      />
      <RenameConflictDialog
        open={!!newFolderConflictPath}
        title="Name Already Exists"
        confirmLabel="OK"
        path={newFolderConflictPath || ''}
        onCancel={() => setNewFolderConflictPath(null)}
        onReplace={async () => {
          setNewFolderConflictPath(null)
        }}
      />
    </div>
  )
}


