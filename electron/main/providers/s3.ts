import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import * as fs from 'fs'
import * as path from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import type {
  BucketInfo,
  ListObjectsResult,
  S3Object,
  ObjectMetadata,
  CopyOptions,
  PresignedUrlOptions,
  ProviderConfig
} from '../../../src/types'
import { StorageProvider, type ProgressCallback } from './base'

const LIST_PAGE_SIZE = 30

function isMultiDeleteNotImplemented(err: any): boolean {
  if (err?.Code === 'NotImplemented' || err?.name === 'NotImplemented') return true
  const msg = String(err?.message || '').toLowerCase()
  const details = String(err?.Details || '').toLowerCase()
  return msg.includes('post ?delete is not implemented') || details.includes('post ?delete is not implemented')
}

function isNotFoundDeleteError(err: any): boolean {
  const statusCode = Number(err?.$metadata?.httpStatusCode || err?.statusCode || 0)
  const code = String(err?.Code || err?.code || err?.name || '').toLowerCase()
  const msg = String(err?.message || '').toLowerCase()
  return (
    statusCode === 404 ||
    code.includes('nosuchkey') ||
    code.includes('notfound') ||
    msg.includes('no such key') ||
    msg.includes('not found')
  )
}

export class S3Provider extends StorageProvider {
  protected client: S3Client

  constructor(config: ProviderConfig) {
    super(config)
    this.client = this.buildClient(config)
  }

  protected buildClient(config: ProviderConfig): S3Client {
    const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
      region: config.region || 'us-east-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    }
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint
      clientConfig.forcePathStyle = true
    }
    return new S3Client(clientConfig)
  }

  async listBuckets(): Promise<BucketInfo[]> {
    const buckets = new Map<string, BucketInfo>()
    let continuationToken: string | undefined = undefined

    // Do not send MaxBuckets: some S3-compatible providers (including R2) reject it.
    do {
      const res = await this.client.send(
        new ListBucketsCommand(
          continuationToken ? { ContinuationToken: continuationToken } : {}
        )
      )
      for (const b of res.Buckets ?? []) {
        if (!b.Name) continue
        buckets.set(b.Name, {
          name: b.Name,
          createdAt: b.CreationDate
        })
      }
      continuationToken = res.ContinuationToken
    } while (continuationToken)

    return [...buckets.values()]
  }

  async listObjects(
    bucket: string,
    prefix: string,
    continuationToken?: string,
    searchQuery?: string
  ): Promise<ListObjectsResult> {
    const q = (searchQuery || '').trim().toLowerCase()
    if (q) {
      const folderMap = new Map<string, S3Object>()
      const fileMap = new Map<string, S3Object>()
      let token: string | undefined = undefined

      // Search must span the whole folder, not just one paginated page.
      do {
        const cmd = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix || undefined,
          Delimiter: '/',
          MaxKeys: 1000,
          ContinuationToken: token
        })
        const res: ListObjectsV2CommandOutput = await this.client.send(cmd)
        const contentByKey = new Map((res.Contents ?? []).map((obj) => [obj.Key!, obj]))

        for (const cp of res.CommonPrefixes ?? []) {
          const key = cp.Prefix!
          const parts = key.split('/').filter(Boolean)
          const marker = contentByKey.get(key)
          const folder: S3Object = {
            key,
            name: parts[parts.length - 1] + '/',
            isFolder: true,
            lastModified: marker?.LastModified
          }
          if (folder.name.toLowerCase().includes(q)) {
            folderMap.set(key, folder)
          }
        }

        for (const obj of res.Contents ?? []) {
          const key = obj.Key!
          if (key === prefix || key.endsWith('/')) continue
          const name = key.split('/').pop() || key
          if (!name.toLowerCase().includes(q)) continue
          fileMap.set(key, {
            key,
            name,
            isFolder: false,
            size: obj.Size,
            lastModified: obj.LastModified,
            etag: obj.ETag?.replace(/"/g, ''),
            storageClass: obj.StorageClass
          })
        }

        token = res.NextContinuationToken
      } while (token)

      return {
        objects: [...folderMap.values(), ...fileMap.values()],
        prefixes: [...folderMap.keys()],
        nextContinuationToken: undefined,
        isTruncated: false
      }
    }

    const cmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      Delimiter: '/',
      MaxKeys: LIST_PAGE_SIZE,
      ContinuationToken: continuationToken || undefined
    })
    const res = await this.client.send(cmd)

    const contentByKey = new Map((res.Contents ?? []).map((obj) => [obj.Key!, obj]))

    const folders: S3Object[] = (res.CommonPrefixes ?? []).map((cp) => {
      const key = cp.Prefix!
      const parts = key.split('/').filter(Boolean)
      const marker = contentByKey.get(key)
      return {
        key,
        name: parts[parts.length - 1] + '/',
        isFolder: true,
        // If a folder marker object exists (e.g. "photos/"), surface its timestamp.
        lastModified: marker?.LastModified
      }
    })

    const files: S3Object[] = (res.Contents ?? [])
      .filter((obj) => obj.Key !== prefix) // skip the prefix itself
      .map((obj) => {
        const key = obj.Key!
        const name = key.split('/').pop() || key
        return {
          key,
          name,
          isFolder: false,
          size: obj.Size,
          lastModified: obj.LastModified,
          etag: obj.ETag?.replace(/"/g, ''),
          storageClass: obj.StorageClass
        }
      })

    return {
      objects: [...folders, ...files],
      prefixes: (res.CommonPrefixes ?? []).map((cp) => cp.Prefix!),
      nextContinuationToken: res.NextContinuationToken,
      isTruncated: res.IsTruncated ?? false
    }
  }

  async uploadFile(
    bucket: string,
    key: string,
    filePath: string,
    onProgress: ProgressCallback,
    contentType?: string
  ): Promise<void> {
    const stats = fs.statSync(filePath)
    const totalBytes = stats.size

    const uploader = new Upload({
      client: this.client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentType: contentType || this.guessContentType(filePath)
      },
      queueSize: 4,
      partSize: 1024 * 1024 * 10 // 10 MB per part
    })

    uploader.on('httpUploadProgress', (progress) => {
      onProgress({
        transferredBytes: progress.loaded ?? 0,
        totalBytes: progress.total ?? totalBytes
      })
    })

    await uploader.done()
  }

  async downloadFile(
    bucket: string,
    key: string,
    destPath: string,
    onProgress: ProgressCallback
  ): Promise<void> {
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key })
    const res = await this.client.send(cmd)

    const totalBytes = res.ContentLength ?? 0
    let transferredBytes = 0

    // Ensure destination directory exists
    fs.mkdirSync(path.dirname(destPath), { recursive: true })

    const writeStream = fs.createWriteStream(destPath)
    const body = res.Body as Readable

    body.on('data', (chunk: Buffer) => {
      transferredBytes += chunk.length
      onProgress({ transferredBytes, totalBytes })
    })

    await pipeline(body, writeStream)
  }

  async deleteObjects(bucket: string, keys: string[]): Promise<void> {
    const expanded = new Set<string>()

    for (const key of keys) {
      if (!key.endsWith('/')) {
        expanded.add(key)
        continue
      }

      // Recursively resolve all objects under the folder prefix.
      let token: string | undefined = undefined
      do {
        const res = await this.client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: key,
          MaxKeys: 1000,
          ContinuationToken: token
        }))
        for (const obj of res.Contents ?? []) {
          if (obj.Key) expanded.add(obj.Key)
        }
        token = res.NextContinuationToken
      } while (token)

      // Include marker key too (safe if it does not exist).
      expanded.add(key)
    }

    const allKeys = [...expanded]
    if (allKeys.length === 0) return

    try {
      // S3 deleteObjects supports up to 1000 per request
      const chunks: string[][] = []
      for (let i = 0; i < allKeys.length; i += 1000) {
        chunks.push(allKeys.slice(i, i + 1000))
      }
      for (const chunk of chunks) {
        const cmd = new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: chunk.map((Key) => ({ Key })),
            Quiet: true
          }
        })
        await this.client.send(cmd)
      }
    } catch (err: any) {
      // Some S3-compatible providers (e.g. GCS XML API) don't implement POST ?delete.
      if (!isMultiDeleteNotImplemented(err)) throw err
      for (const key of allKeys) {
        try {
          await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
        } catch (deleteErr: any) {
          // Ignore missing keys (common for virtual folder marker deletes).
          if (!isNotFoundDeleteError(deleteErr)) throw deleteErr
        }
      }
    }
  }

  async copyObject(options: CopyOptions): Promise<void> {
    const { srcBucket, srcKey, destBucket, destKey } = options
    const cmd = new CopyObjectCommand({
      CopySource: `${srcBucket}/${srcKey}`,
      Bucket: destBucket,
      Key: destKey
    })
    await this.client.send(cmd)
  }

  async createFolder(bucket: string, prefix: string): Promise<void> {
    const key = prefix.endsWith('/') ? prefix : prefix + '/'
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: ''
    })
    await this.client.send(cmd)
  }

  async getPresignedUrl(options: PresignedUrlOptions): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: options.bucket,
      Key: options.key
    })
    return getSignedUrl(this.client, cmd, { expiresIn: options.expiresIn })
  }

  async getObjectMetadata(bucket: string, key: string): Promise<ObjectMetadata> {
    const cmd = new HeadObjectCommand({ Bucket: bucket, Key: key })
    const res = await this.client.send(cmd)
    return {
      contentType: res.ContentType,
      contentLength: res.ContentLength,
      lastModified: res.LastModified?.toISOString(),
      etag: res.ETag?.replace(/"/g, ''),
      storageClass: res.StorageClass,
      metadata: res.Metadata,
      versionId: res.VersionId
    }
  }

  async updateObjectMetadata(
    bucket: string,
    key: string,
    metadata: Record<string, string>
  ): Promise<void> {
    // S3 metadata update requires copy-in-place
    const cmd = new CopyObjectCommand({
      CopySource: `${bucket}/${key}`,
      Bucket: bucket,
      Key: key,
      Metadata: metadata,
      MetadataDirective: 'REPLACE'
    })
    await this.client.send(cmd)
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
