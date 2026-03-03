import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  ProviderConfig,
  UploadOptions,
  DownloadOptions,
  DownloadZipOptions,
  CopyOptions,
  PresignedUrlOptions,
  AppPreferences
} from '../../src/types'

// ─── API exposed to renderer ──────────────────────────────────────────────────

const api = {
  providers: {
    list: (): Promise<ProviderConfig[]> => ipcRenderer.invoke('providers:list'),
    save: (config: ProviderConfig): Promise<ProviderConfig> =>
      ipcRenderer.invoke('providers:save', config),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('providers:delete', id),
    test: (config: ProviderConfig): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('providers:test', config)
  },

  buckets: {
    list: (providerId: string) => ipcRenderer.invoke('buckets:list', providerId)
  },

  objects: {
    list: (
      providerId: string,
      bucket: string,
      prefix: string,
      continuationToken?: string,
      searchQuery?: string
    ) => ipcRenderer.invoke('objects:list', providerId, bucket, prefix, continuationToken, searchQuery),
    delete: (providerId: string, bucket: string, keys: string[]) =>
      ipcRenderer.invoke('objects:delete', providerId, bucket, keys),
    copy: (options: CopyOptions) => ipcRenderer.invoke('objects:copy', options),
    rename: (providerId: string, bucket: string, srcKey: string, destKey: string) =>
      ipcRenderer.invoke('objects:rename', providerId, bucket, srcKey, destKey),
    createFolder: (providerId: string, bucket: string, prefix: string) =>
      ipcRenderer.invoke('objects:createFolder', providerId, bucket, prefix),
    presignedUrl: (options: PresignedUrlOptions) =>
      ipcRenderer.invoke('objects:presignedUrl', options),
    metadata: (providerId: string, bucket: string, key: string) =>
      ipcRenderer.invoke('objects:metadata', providerId, bucket, key),
    open: (providerId: string, bucket: string, key: string) =>
      ipcRenderer.invoke('objects:open', providerId, bucket, key),
    updateMetadata: (
      providerId: string,
      bucket: string,
      key: string,
      metadata: Record<string, string>
    ) => ipcRenderer.invoke('objects:updateMetadata', providerId, bucket, key, metadata)
  },

  transfer: {
    upload: (options: UploadOptions) => ipcRenderer.invoke('transfer:upload', options),
    download: (options: DownloadOptions) => ipcRenderer.invoke('transfer:download', options),
    downloadZip: (options: DownloadZipOptions) => ipcRenderer.invoke('transfer:downloadZip', options),
    onProgress: (
      callback: (data: { transferId: string; transferredBytes: number; totalBytes: number }) => void
    ) => {
      const handler = (_: Electron.IpcRendererEvent, data: any) => callback(data)
      ipcRenderer.on('transfer:progress', handler)
      return () => ipcRenderer.removeListener('transfer:progress', handler)
    },
    onComplete: (callback: (data: { transferId: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: any) => callback(data)
      ipcRenderer.on('transfer:complete', handler)
      return () => ipcRenderer.removeListener('transfer:complete', handler)
    },
    onError: (callback: (data: { transferId: string; error: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: any) => callback(data)
      ipcRenderer.on('transfer:error', handler)
      return () => ipcRenderer.removeListener('transfer:error', handler)
    }
  },

  dialog: {
    openFile: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('dialog:openFile', options),
    openDirectory: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('dialog:openDirectory', options),
    saveFile: (options?: Electron.SaveDialogOptions) =>
      ipcRenderer.invoke('dialog:saveFile', options)
  },

  shell: {
    openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
    showInFolder: (filePath: string) => ipcRenderer.invoke('shell:showInFolder', filePath)
  },

  prefs: {
    get: (): Promise<AppPreferences> => ipcRenderer.invoke('prefs:get'),
    save: (prefs: Partial<AppPreferences>): Promise<void> =>
      ipcRenderer.invoke('prefs:save', prefs)
  },

  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },

  files: {
    getPath: (file: File): string => webUtils.getPathForFile(file),
    expandForUpload: (paths: string[]): Promise<Array<{ filePath: string; relativePath: string }>> =>
      ipcRenderer.invoke('files:expandForUpload', paths)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
