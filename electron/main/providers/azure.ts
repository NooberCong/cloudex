import {
  BlobSASPermissions,
  BlobServiceClient,
  BlockBlobClient,
  ContainerClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters
} from '@azure/storage-blob'
import * as fs from 'fs'
import * as path from 'path'
import type {
  BucketInfo,
  CopyOptions,
  ListObjectsResult,
  ObjectMetadata,
  PresignedUrlOptions,
  ProviderConfig,
  S3Object
} from '../../../src/types'
import { StorageProvider, type ProgressCallback } from './base'

const LIST_PAGE_SIZE = 30

export class AzureBlobProvider extends StorageProvider {
  private readonly accountName: string
  private readonly sharedKeyCredential: StorageSharedKeyCredential
  private readonly serviceClient: BlobServiceClient

  constructor(config: ProviderConfig) {
    super(config)
    this.accountName = (config.accessKeyId || '').trim()
    if (!this.accountName) {
      throw new Error('Azure Blob Storage requires Account Name in Access Key ID field.')
    }

    this.sharedKeyCredential = new StorageSharedKeyCredential(this.accountName, config.secretAccessKey)
    const endpoint = config.endpoint?.trim() || `https://${this.accountName}.blob.core.windows.net`
    this.serviceClient = new BlobServiceClient(endpoint, this.sharedKeyCredential)
  }

  async listBuckets(): Promise<BucketInfo[]> {
    const out: BucketInfo[] = []
    for await (const page of this.serviceClient.listContainers().byPage({ maxPageSize: 200 })) {
      for (const container of page.containerItems ?? []) {
        if (!container.name) continue
        out.push({
          name: container.name,
          createdAt: container.properties.lastModified
        })
      }
    }
    return out
  }

  async listObjects(
    bucket: string,
    prefix: string,
    continuationToken?: string,
    searchQuery?: string
  ): Promise<ListObjectsResult> {
    const container = this.getContainerClient(bucket)
    const normalizedPrefix = prefix || undefined
    const q = (searchQuery || '').trim().toLowerCase()

    if (q) {
      const folderMap = new Map<string, S3Object>()
      const fileMap = new Map<string, S3Object>()
      let token: string | undefined = undefined

      do {
        const iterator = container
          .listBlobsByHierarchy('/', { prefix: normalizedPrefix })
          .byPage({ continuationToken: token, maxPageSize: 1000 })
        const next = await iterator.next()
        if (next.done || !next.value) break
        const page: any = next.value

        for (const bp of page.segment?.blobPrefixes ?? []) {
          const key = bp.name as string
          const parts = key.split('/').filter(Boolean)
          const folder: S3Object = {
            key,
            name: `${parts[parts.length - 1] || key}/`,
            isFolder: true
          }
          if (folder.name.toLowerCase().includes(q)) folderMap.set(key, folder)
        }

        for (const blob of page.segment?.blobItems ?? []) {
          const key = blob.name as string
          if (key === prefix || key.endsWith('/')) continue
          const name = key.split('/').pop() || key
          if (!name.toLowerCase().includes(q)) continue
          fileMap.set(key, {
            key,
            name,
            isFolder: false,
            size: blob.properties?.contentLength,
            lastModified: blob.properties?.lastModified,
            etag: blob.properties?.etag?.replace(/"/g, '')
          })
        }

        token = page.continuationToken
      } while (token)

      return {
        objects: [...folderMap.values(), ...fileMap.values()],
        prefixes: [...folderMap.keys()],
        nextContinuationToken: undefined,
        isTruncated: false
      }
    }

    const iterator = container
      .listBlobsByHierarchy('/', { prefix: normalizedPrefix })
      .byPage({ continuationToken, maxPageSize: LIST_PAGE_SIZE })
    const next = await iterator.next()
    if (next.done || !next.value) {
      return { objects: [], prefixes: [], nextContinuationToken: undefined, isTruncated: false }
    }
    const page: any = next.value

    const folders: S3Object[] = (page.segment?.blobPrefixes ?? []).map((bp: any) => {
      const key = bp.name as string
      const parts = key.split('/').filter(Boolean)
      return {
        key,
        name: `${parts[parts.length - 1] || key}/`,
        isFolder: true
      }
    })

    const files: S3Object[] = (page.segment?.blobItems ?? [])
      .filter((blob: any) => blob.name !== prefix && !String(blob.name || '').endsWith('/'))
      .map((blob: any) => {
        const key = blob.name as string
        const name = key.split('/').pop() || key
        return {
          key,
          name,
          isFolder: false,
          size: blob.properties?.contentLength,
          lastModified: blob.properties?.lastModified,
          etag: blob.properties?.etag?.replace(/"/g, '')
        }
      })

    return {
      objects: [...folders, ...files],
      prefixes: folders.map((f) => f.key),
      nextContinuationToken: page.continuationToken,
      isTruncated: !!page.continuationToken
    }
  }

  async uploadFile(
    bucket: string,
    key: string,
    filePath: string,
    onProgress: ProgressCallback,
    contentType?: string
  ): Promise<void> {
    const blockBlob = this.getContainerClient(bucket).getBlockBlobClient(key)
    const totalBytes = fs.statSync(filePath).size

    await blockBlob.uploadFile(filePath, {
      blobHTTPHeaders: {
        blobContentType: contentType || this.guessContentType(filePath)
      },
      onProgress: (ev) => {
        onProgress({ transferredBytes: ev.loadedBytes, totalBytes })
      }
    })
  }

  async downloadFile(
    bucket: string,
    key: string,
    destPath: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    const blob = this.getContainerClient(bucket).getBlobClient(key)
    fs.mkdirSync(path.dirname(destPath), { recursive: true })
    const props = await blob.getProperties()
    const totalBytes = props.contentLength ?? 0

    await blob.downloadToFile(destPath, 0, undefined, {
      onProgress: (ev) => {
        onProgress({ transferredBytes: ev.loadedBytes, totalBytes })
      }
    })
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<void> {
    const container = this.getContainerClient(bucket)
    const expanded = new Set<string>()

    for (const key of keys) {
      if (!key.endsWith('/')) {
        expanded.add(key)
        continue
      }

      for await (const blob of container.listBlobsFlat({ prefix: key })) {
        if (blob.name) expanded.add(blob.name)
      }
      expanded.add(key)
    }

    for (const key of expanded) {
      await container.deleteBlob(key, { deleteSnapshots: 'include' }).catch(() => {})
    }
  }

  async copyObject(options: CopyOptions): Promise<void> {
    const src = this.getContainerClient(options.srcBucket).getBlobClient(options.srcKey)
    const dest = this.getContainerClient(options.destBucket).getBlockBlobClient(options.destKey)

    try {
      const poller = await dest.beginCopyFromURL(src.url)
      await poller.pollUntilDone()
      return
    } catch {
      // Fallback for environments where server-side copy auth is restricted.
    }

    const download = await src.download()
    const stream = download.readableStreamBody
    if (!stream) throw new Error('Failed to read source blob stream.')
    await dest.uploadStream(stream)
  }

  async createFolder(bucket: string, prefix: string): Promise<void> {
    const key = prefix.endsWith('/') ? prefix : `${prefix}/`
    const blob = this.getContainerClient(bucket).getBlockBlobClient(key)
    await blob.upload('', 0)
  }

  async getPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    const blob = this.getContainerClient(options.bucket).getBlobClient(options.key)
    const startsOn = new Date(Date.now() - 2 * 60 * 1000)
    const expiresOn = new Date(Date.now() + options.expiresIn * 1000)
    const sas = generateBlobSASQueryParameters(
      {
        containerName: options.bucket,
        blobName: options.key,
        permissions: BlobSASPermissions.parse('r'),
        startsOn,
        expiresOn
      },
      this.sharedKeyCredential
    ).toString()
    return `${blob.url}?${sas}`
  }

  async getObjectMetadata(bucket: string, key: string): Promise<ObjectMetadata> {
    try {
      const props = await this.getContainerClient(bucket).getBlobClient(key).getProperties()
      return {
        contentType: props.contentType,
        contentLength: props.contentLength,
        lastModified: props.lastModified?.toISOString(),
        etag: props.etag?.replace(/"/g, ''),
        metadata: props.metadata
      }
    } catch (err: any) {
      const statusCode = Number(err?.statusCode || err?.details?.statusCode || 0)
      const errorCode = String(err?.code || err?.details?.errorCode || '').toLowerCase()
      if (statusCode === 404 || errorCode === 'blobnotfound') {
        throw new Error('BlobNotFound')
      }
      throw err
    }
  }

  async updateObjectMetadata(
    bucket: string,
    key: string,
    metadata: Record<string, string>
  ): Promise<void> {
    await this.getContainerClient(bucket).getBlobClient(key).setMetadata(metadata)
  }

  private getContainerClient(bucket: string): ContainerClient {
    return this.serviceClient.getContainerClient(bucket)
  }

  private guessContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const map: Record<string, string> = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf', '.html': 'text/html', '.htm': 'text/html',
      '.css': 'text/css', '.js': 'application/javascript',
      '.ts': 'application/typescript', '.json': 'application/json',
      '.xml': 'application/xml', '.zip': 'application/zip',
      '.tar': 'application/x-tar', '.gz': 'application/gzip',
      '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
      '.txt': 'text/plain', '.md': 'text/markdown',
      '.woff': 'font/woff', '.woff2': 'font/woff2',
      '.ttf': 'font/ttf'
    }
    return map[ext] || 'application/octet-stream'
  }
}
