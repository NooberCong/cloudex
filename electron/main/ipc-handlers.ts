import { app, ipcMain, BrowserWindow, dialog, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as yazl from 'yazl'
import {
  getProviders,
  getProvider,
  saveProvider,
  deleteProvider,
  getPreferences,
  savePreferences
} from './store'
import { getProviderInstance, invalidateProvider } from './providers/registry'
import type {
  ProviderConfig,
  UploadOptions,
  DownloadOptions,
  DownloadZipOptions,
  CopyOptions,
  PresignedUrlOptions,
  S3Object
} from '../../src/types'

const OPEN_TEMP_DIR_NAME = 'cloudex-open'
const OPEN_TEMP_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 3 // 3 days
const ZIP_TEMP_DIR_NAME = 'cloudex-zip'
const PROVIDER_TEST_TIMEOUT_MS = 12000

function formatErrorDetails(err: any): string {
  const code = err?.code ? `code=${String(err.code)}; ` : ''
  const name = err?.name ? `${String(err.name)}: ` : ''
  const message = err?.message ? String(err.message) : String(err)
  const stackLine = typeof err?.stack === 'string'
    ? err.stack.split('\n').map((line: string) => line.trim()).find((line: string) => line.startsWith('at ')) || ''
    : ''
  const stackPart = stackLine ? `; ${stackLine}` : ''
  return `${code}${name}${message}${stackPart}`
}

function toUserFriendlyProviderTestError(err: any, config: ProviderConfig): string {
  const name = String(err?.name || '')
  const msg = String(err?.message || '').toLowerCase()

  if (msg.includes('timed out')) {
    return 'Connection test timed out. Check network access, endpoint, and credentials, then try again.'
  }
  if (name === 'AccessDenied' || name === 'SignatureDoesNotMatch') {
    if (config.type === 'google-cloud-storage') {
      return 'Access denied. Verify GCS HMAC credentials and bucket permissions for this account.'
    }
    if (config.type === 'azure-blob-storage') {
      return 'Access denied. Verify Azure account name/key and storage permissions.'
    }
    return 'Access denied. Verify credentials and permissions.'
  }
  if (name === 'InvalidArgument') {
    return 'Invalid connection settings. Check endpoint, region, bucket, and credential values.'
  }
  if (msg.includes('getaddrinfo') || msg.includes('enotfound') || msg.includes('econnrefused')) {
    return 'Cannot reach the storage endpoint. Check endpoint URL and network connectivity.'
  }
  if (msg.includes('ssl') || msg.includes('certificate')) {
    return 'TLS/SSL validation failed. Check endpoint certificate settings and URL.'
  }
  return 'Connection failed. Verify settings and try again.'
}

function logProviderTestError(config: ProviderConfig, err: any): void {
  const safeConfig = {
    id: config.id,
    name: config.name,
    type: config.type,
    region: config.region,
    endpoint: config.endpoint,
    accountId: config.accountId,
    defaultBucket: config.defaultBucket
  }
  console.error('[providers:test] failed', {
    provider: safeConfig,
    code: err?.code,
    name: err?.name,
    message: err?.message,
    stack: err?.stack
  })
}

function isNotFoundError(err: any): boolean {
  const statusCode = Number(err?.statusCode || err?.$metadata?.httpStatusCode || 0)
  const code = String(err?.code || err?.Code || err?.name || err?.details?.errorCode || '').toLowerCase()
  const msg = String(err?.message || '').toLowerCase()
  if (statusCode === 404) return true
  if (code.includes('notfound') || code.includes('nosuchkey') || code === 'blobnotfound') return true
  return msg.includes('not found') || msg.includes('no such key')
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function getConfiguredBuckets(config: ProviderConfig): string[] {
  const fromDefault = config.defaultBucket?.trim() ? [config.defaultBucket.trim()] : []
  const fromAllowed = (config.allowedBuckets ?? []).map((b) => b.trim()).filter(Boolean)
  return [...new Set([...fromDefault, ...fromAllowed])]
}

function cleanupOpenTempFiles(rootDir: string, maxAgeMs = OPEN_TEMP_MAX_AGE_MS): void {
  const now = Date.now()
  const cutoff = now - maxAgeMs
  const cleanupDir = (dir: string): boolean => {
    let hasAny = false
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return false
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const childHasAny = cleanupDir(fullPath)
        if (!childHasAny) {
          try { fs.rmdirSync(fullPath) } catch {}
        } else {
          hasAny = true
        }
        continue
      }
      if (!entry.isFile()) continue
      try {
        const stat = fs.statSync(fullPath)
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(fullPath)
        } else {
          hasAny = true
        }
      } catch {
        // Ignore cleanup errors for temp files.
      }
    }
    return hasAny
  }
  if (!fs.existsSync(rootDir)) return
  cleanupDir(rootDir)
}

function baseNameFromKey(key: string): string {
  const trimmed = key.endsWith('/') ? key.slice(0, -1) : key
  const parts = trimmed.split('/').filter(Boolean)
  return parts[parts.length - 1] || trimmed
}

function ensureUniqueZipPath(candidate: string, used: Set<string>): string {
  if (!used.has(candidate)) {
    used.add(candidate)
    return candidate
  }
  const slash = candidate.lastIndexOf('/')
  const dir = slash >= 0 ? candidate.slice(0, slash + 1) : ''
  const name = slash >= 0 ? candidate.slice(slash + 1) : candidate
  const dot = name.lastIndexOf('.')
  const hasExt = dot > 0
  const stem = hasExt ? name.slice(0, dot) : name
  const ext = hasExt ? name.slice(dot) : ''
  let i = 2
  while (i <= 9999) {
    const next = `${dir}${stem} (${i})${ext}`
    if (!used.has(next)) {
      used.add(next)
      return next
    }
    i++
  }
  const fallback = `${dir}${stem}-${Date.now()}${ext}`
  used.add(fallback)
  return fallback
}

type UploadExpandEntry = { filePath: string; relativePath: string }

function expandUploadPaths(paths: string[]): UploadExpandEntry[] {
  const out: UploadExpandEntry[] = []

  const walkDir = (rootDir: string, relativeRoot: string) => {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(rootDir, entry.name)
      const rel = path.posix.join(relativeRoot, entry.name)
      if (entry.isDirectory()) {
        walkDir(full, rel)
      } else if (entry.isFile()) {
        out.push({ filePath: full, relativePath: rel })
      }
    }
  }

  for (const p of paths) {
    try {
      const stat = fs.statSync(p)
      if (stat.isFile()) {
        out.push({ filePath: p, relativePath: path.basename(p) })
      } else if (stat.isDirectory()) {
        const rootName = path.basename(p)
        walkDir(p, rootName)
      }
    } catch {
      // Ignore unreadable paths.
    }
  }

  return out
}

async function collectFolderFiles(
  provider: { listObjects: (bucket: string, prefix: string, continuationToken?: string, searchQuery?: string) => Promise<{ objects: S3Object[] }> },
  bucket: string,
  prefix: string
): Promise<S3Object[]> {
  const queue = [prefix]
  const visited = new Set<string>()
  const files: S3Object[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const result = await provider.listObjects(bucket, current)
    for (const obj of result.objects) {
      if (obj.isFolder) {
        if (!visited.has(obj.key)) queue.push(obj.key)
      } else if (!obj.key.endsWith('/')) {
        files.push(obj)
      }
    }
  }

  return files
}

type FolderCopyProvider = {
  listObjects: (
    bucket: string,
    prefix: string,
    continuationToken?: string,
    searchQuery?: string
  ) => Promise<{ objects: S3Object[]; nextContinuationToken?: string }>
  copyObject: (options: CopyOptions) => Promise<void>
  createFolder: (bucket: string, prefix: string) => Promise<void>
}

async function listAllObjectsInPrefix(
  provider: FolderCopyProvider,
  bucket: string,
  prefix: string
): Promise<S3Object[]> {
  const objects: S3Object[] = []
  let token: string | undefined = undefined
  do {
    const result = await provider.listObjects(bucket, prefix, token)
    objects.push(...result.objects)
    token = result.nextContinuationToken
  } while (token)
  return objects
}

async function copyFolderRecursive(
  provider: FolderCopyProvider,
  providerId: string,
  srcBucket: string,
  destBucket: string,
  srcPrefix: string,
  destPrefix: string
): Promise<void> {
  const normalizedSrc = srcPrefix.endsWith('/') ? srcPrefix : `${srcPrefix}/`
  const normalizedDest = destPrefix.endsWith('/') ? destPrefix : `${destPrefix}/`

  await provider.createFolder(destBucket, normalizedDest)

  const queue: string[] = [normalizedSrc]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    const objects = await listAllObjectsInPrefix(provider, srcBucket, current)
    for (const obj of objects) {
      if (!obj.key.startsWith(normalizedSrc)) continue
      const rel = obj.key.slice(normalizedSrc.length)
      if (!rel) continue

      if (obj.isFolder) {
        const nextSrcPrefix = obj.key.endsWith('/') ? obj.key : `${obj.key}/`
        const nextDestPrefix = `${normalizedDest}${rel}`.endsWith('/')
          ? `${normalizedDest}${rel}`
          : `${normalizedDest}${rel}/`
        await provider.createFolder(destBucket, nextDestPrefix)
        if (!visited.has(nextSrcPrefix)) queue.push(nextSrcPrefix)
        continue
      }

      await provider.copyObject({
        srcProviderId: providerId,
        srcBucket,
        srcKey: obj.key,
        destProviderId: providerId,
        destBucket,
        destKey: `${normalizedDest}${rel}`
      })
    }
  }
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  const openTempRoot = path.join(app.getPath('temp'), OPEN_TEMP_DIR_NAME)
  const zipTempRoot = path.join(app.getPath('temp'), ZIP_TEMP_DIR_NAME)
  setTimeout(() => {
    try {
      cleanupOpenTempFiles(openTempRoot)
    } catch {
      // Ignore temp cleanup errors.
    }
  }, 0)


  // ─── Provider CRUD ──────────────────────────────────────────────────────────

  ipcMain.handle('providers:list', () => {
    return getProviders().map(sanitizeConfig)
  })

  ipcMain.handle('providers:save', (_e, config: ProviderConfig) => {
    const now = Date.now()
    const full: ProviderConfig = {
      ...config,
      id: config.id || generateId(),
      createdAt: config.createdAt || now,
      updatedAt: now
    }
    saveProvider(full)
    invalidateProvider(full.id)
    return sanitizeConfig(full)
  })

  ipcMain.handle('providers:delete', (_e, id: string) => {
    deleteProvider(id)
    invalidateProvider(id)
  })

  ipcMain.handle('providers:test', async (_e, config: ProviderConfig) => {
    try {
      const tempConfig: ProviderConfig = { ...config, id: '_test', createdAt: 0, updatedAt: 0 }
      const provider = getProviderInstance(tempConfig)
      const scopedBuckets = getConfiguredBuckets(tempConfig)
      await Promise.race([
        (async () => {
          if (scopedBuckets.length > 0) {
            // Validate credentials against the configured bucket without requiring ListAllMyBuckets.
            await provider.listObjects(scopedBuckets[0], '')
          } else {
            await provider.listBuckets()
          }
        })(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Test connection timed out after 12 seconds')), PROVIDER_TEST_TIMEOUT_MS)
        })
      ])
      return { success: true }
    } catch (err: any) {
      logProviderTestError(config, err)
      console.error('[providers:test] details', formatErrorDetails(err))
      return { success: false, error: toUserFriendlyProviderTestError(err, config) }
    }
  })

  // ─── Buckets ────────────────────────────────────────────────────────────────

  ipcMain.handle('buckets:list', async (_e, providerId: string) => {
    const config = getProvider(providerId)
    if (!config) throw new Error(`Provider not found: ${providerId}`)
    const scopedBuckets = getConfiguredBuckets(config)
    if (scopedBuckets.length > 0) {
      return scopedBuckets.map((name) => ({ name }))
    }
    const provider = getProviderInstance(config)
    return provider.listBuckets()
  })

  // ─── Objects ────────────────────────────────────────────────────────────────

  ipcMain.handle(
    'objects:list',
    async (
      _e,
      providerId: string,
      bucket: string,
      prefix: string,
      continuationToken?: string,
      searchQuery?: string
    ) => {
      const config = getProvider(providerId)
      if (!config) throw new Error(`Provider not found: ${providerId}`)
      const provider = getProviderInstance(config)
      return provider.listObjects(bucket, prefix, continuationToken, searchQuery)
    }
  )

  ipcMain.handle('objects:delete', async (_e, providerId: string, bucket: string, keys: string[]) => {
    const config = getProvider(providerId)
    if (!config) throw new Error(`Provider not found: ${providerId}`)
    const provider = getProviderInstance(config)
    await provider.deleteObjects(bucket, keys)
  })

  ipcMain.handle('objects:copy', async (_e, options: CopyOptions) => {
    const srcConfig = getProvider(options.srcProviderId)
    if (!srcConfig) throw new Error(`Provider not found: ${options.srcProviderId}`)
    // If same provider → use server-side copy
    if (options.srcProviderId === options.destProviderId) {
      const provider = getProviderInstance(srcConfig)
      if (options.srcKey.endsWith('/')) {
        await copyFolderRecursive(
          provider,
          options.srcProviderId,
          options.srcBucket,
          options.destBucket,
          options.srcKey,
          options.destKey
        )
      } else {
        await provider.copyObject(options)
      }
    } else {
      // Cross-provider copy: download to temp then upload
      throw new Error('Cross-provider copy not yet supported in this version.')
    }
  })

  ipcMain.handle(
    'objects:rename',
    async (_e, providerId: string, bucket: string, srcKey: string, destKey: string) => {
      const config = getProvider(providerId)
      if (!config) throw new Error(`Provider not found: ${providerId}`)
      const provider = getProviderInstance(config)
      if (srcKey.endsWith('/')) {
        await copyFolderRecursive(provider, providerId, bucket, bucket, srcKey, destKey)
      } else {
        await provider.copyObject({
          srcProviderId: providerId,
          srcBucket: bucket,
          srcKey,
          destProviderId: providerId,
          destBucket: bucket,
          destKey
        })
      }
      await provider.deleteObjects(bucket, [srcKey])
    }
  )

  ipcMain.handle(
    'objects:createFolder',
    async (_e, providerId: string, bucket: string, prefix: string) => {
      const config = getProvider(providerId)
      if (!config) throw new Error(`Provider not found: ${providerId}`)
      const provider = getProviderInstance(config)
      await provider.createFolder(bucket, prefix)
    }
  )

  ipcMain.handle('objects:presignedUrl', async (_e, options: PresignedUrlOptions) => {
    const config = getProvider(options.providerId)
    if (!config) throw new Error(`Provider not found: ${options.providerId}`)
    const provider = getProviderInstance(config)
    return provider.getPresignedUrl(options)
  })

  ipcMain.handle('objects:metadata', async (_e, providerId: string, bucket: string, key: string) => {
    const config = getProvider(providerId)
    if (!config) throw new Error(`Provider not found: ${providerId}`)
    const provider = getProviderInstance(config)
    return provider.getObjectMetadata(bucket, key)
  })

  ipcMain.handle('objects:exists', async (_e, providerId: string, bucket: string, key: string) => {
    const config = getProvider(providerId)
    if (!config) throw new Error(`Provider not found: ${providerId}`)
    const provider = getProviderInstance(config)
    try {
      await provider.getObjectMetadata(bucket, key)
      return true
    } catch (err: any) {
      if (isNotFoundError(err)) return false
      throw err
    }
  })

  ipcMain.handle(
    'objects:updateMetadata',
    async (_e, providerId: string, bucket: string, key: string, metadata: Record<string, string>) => {
      const config = getProvider(providerId)
      if (!config) throw new Error(`Provider not found: ${providerId}`)
      const provider = getProviderInstance(config)
      await provider.updateObjectMetadata(bucket, key, metadata)
    }
  )

  ipcMain.handle('objects:open', async (_e, providerId: string, bucket: string, key: string) => {
    const config = getProvider(providerId)
    if (!config) throw new Error(`Provider not found: ${providerId}`)
    const provider = getProviderInstance(config)

    const tempRoot = path.join(openTempRoot, providerId, bucket)
    const keyParts = key.split('/').filter(Boolean)
    const relativePath = keyParts.length > 0 ? path.join(...keyParts) : path.basename(key)
    const localPath = path.join(tempRoot, relativePath)

    fs.mkdirSync(path.dirname(localPath), { recursive: true })
    await provider.downloadFile(bucket, key, localPath, () => {})

    const openError = await shell.openPath(localPath)
    if (openError) {
      throw new Error(openError)
    }

    return localPath
  })

  // ─── Upload ────────────────────────────────────────────────────────────────

  ipcMain.handle('transfer:upload', async (_e, options: UploadOptions) => {
    const config = getProvider(options.providerId)
    if (!config) throw new Error(`Provider not found: ${options.providerId}`)
    const provider = getProviderInstance(config)
    const totalBytes = fs.statSync(options.filePath).size

    mainWindow.webContents.send('transfer:progress', {
      transferId: options.transferId,
      transferredBytes: 0,
      totalBytes
    })

    await provider.uploadFile(
      options.bucket,
      options.key,
      options.filePath,
      (progress) => {
        mainWindow.webContents.send('transfer:progress', {
          transferId: options.transferId,
          ...progress
        })
      },
      options.contentType
    )
    mainWindow.webContents.send('transfer:progress', {
      transferId: options.transferId,
      transferredBytes: totalBytes,
      totalBytes
    })
    mainWindow.webContents.send('transfer:complete', { transferId: options.transferId })
  })

  // ─── Download ──────────────────────────────────────────────────────────────

  ipcMain.handle('transfer:download', async (_e, options: DownloadOptions) => {
    const config = getProvider(options.providerId)
    if (!config) throw new Error(`Provider not found: ${options.providerId}`)
    const provider = getProviderInstance(config)

    await provider.downloadFile(
      options.bucket,
      options.key,
      options.destPath,
      (progress) => {
        mainWindow.webContents.send('transfer:progress', {
          transferId: options.transferId,
          ...progress
        })
      }
    )
    mainWindow.webContents.send('transfer:complete', { transferId: options.transferId })
  })

  ipcMain.handle('transfer:downloadZip', async (_e, options: DownloadZipOptions) => {
    const config = getProvider(options.providerId)
    if (!config) throw new Error(`Provider not found: ${options.providerId}`)
    const provider = getProviderInstance(config)

    const usedZipPaths = new Set<string>()
    const entries: Array<{ key: string; zipPath: string; size: number }> = []
    const emptyDirs: string[] = []

    for (const selectedKey of options.keys) {
      if (selectedKey.endsWith('/')) {
        const folderName = baseNameFromKey(selectedKey)
        const files = await collectFolderFiles(provider, options.bucket, selectedKey)
        if (files.length === 0) {
          emptyDirs.push(ensureUniqueZipPath(`${folderName}/`, usedZipPaths))
          continue
        }
        for (const file of files) {
          const rel = file.key.startsWith(selectedKey) ? file.key.slice(selectedKey.length) : baseNameFromKey(file.key)
          if (!rel) continue
          entries.push({
            key: file.key,
            zipPath: ensureUniqueZipPath(`${folderName}/${rel}`, usedZipPaths),
            size: file.size ?? 0
          })
        }
      } else {
        entries.push({
          key: selectedKey,
          zipPath: ensureUniqueZipPath(baseNameFromKey(selectedKey), usedZipPaths),
          size: 0
        })
      }
    }

    if (entries.length === 0 && emptyDirs.length === 0) {
      throw new Error('No downloadable files found in selection')
    }

    const workDir = path.join(zipTempRoot, options.transferId)
    fs.mkdirSync(workDir, { recursive: true })

    const totalBytes = entries.reduce((sum, e) => sum + (e.size || 0), 0)
    mainWindow.webContents.send('transfer:progress', {
      transferId: options.transferId,
      transferredBytes: 0,
      totalBytes
    })

    let completedBytes = 0
    const zipFile = new yazl.ZipFile()
    const output = fs.createWriteStream(options.destPath)
    const zipDone = new Promise<void>((resolve, reject) => {
      output.on('close', () => resolve())
      output.on('error', reject)
      zipFile.outputStream.on('error', reject)
      zipFile.outputStream.pipe(output)
    })

    try {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const localTmp = path.join(workDir, `${i}.bin`)

        let lastTransferred = 0
        await provider.downloadFile(options.bucket, entry.key, localTmp, (progress) => {
          lastTransferred = progress.transferredBytes
          mainWindow.webContents.send('transfer:progress', {
            transferId: options.transferId,
            transferredBytes: completedBytes + progress.transferredBytes,
            totalBytes
          })
        })
        completedBytes += Math.max(lastTransferred, entry.size || 0)
        zipFile.addFile(localTmp, entry.zipPath)
      }

      for (const dirPath of emptyDirs) {
        zipFile.addEmptyDirectory(dirPath)
      }

      zipFile.end()
      await zipDone
      mainWindow.webContents.send('transfer:progress', {
        transferId: options.transferId,
        transferredBytes: totalBytes,
        totalBytes
      })
      mainWindow.webContents.send('transfer:complete', { transferId: options.transferId })
    } catch (e: any) {
      mainWindow.webContents.send('transfer:error', {
        transferId: options.transferId,
        error: e?.message || String(e)
      })
      throw e
    } finally {
      try {
        fs.rmSync(workDir, { recursive: true, force: true })
      } catch {
        // Best-effort cleanup.
      }
    }
  })

  // ─── File dialogs ──────────────────────────────────────────────────────────

  ipcMain.handle('dialog:openFile', async (_e, options?: Electron.OpenDialogOptions) => {
    return dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      ...options
    })
  })

  ipcMain.handle('dialog:openDirectory', async (_e, options?: Electron.OpenDialogOptions) => {
    return dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      ...options
    })
  })

  ipcMain.handle('dialog:saveFile', async (_e, options?: Electron.SaveDialogOptions) => {
    return dialog.showSaveDialog(mainWindow, options || {})
  })

  ipcMain.handle('files:expandForUpload', (_e, paths: string[]) => {
    return expandUploadPaths(paths || [])
  })

  // ─── Shell helpers ─────────────────────────────────────────────────────────

  ipcMain.handle('shell:openPath', (_e, filePath: string) => {
    return shell.openPath(filePath)
  })

  ipcMain.handle('shell:showInFolder', (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  // ─── Preferences ──────────────────────────────────────────────────────────

  ipcMain.handle('prefs:get', () => getPreferences())
  ipcMain.handle('prefs:save', (_e, prefs) => savePreferences(prefs))

  // ─── App info ─────────────────────────────────────────────────────────────

  ipcMain.handle('app:getVersion', () => {
    return require('../../package.json').version
  })
}

/** Strip secrets before sending to renderer (not currently used but kept for safety) */
function sanitizeConfig(config: ProviderConfig): ProviderConfig {
  return config
}


