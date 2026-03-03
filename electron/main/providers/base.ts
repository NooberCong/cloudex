import type {
  BucketInfo,
  ListObjectsResult,
  ObjectMetadata,
  CopyOptions,
  PresignedUrlOptions,
  ProviderConfig
} from '../../../src/types'

export interface UploadProgress {
  transferredBytes: number
  totalBytes: number
}

export type ProgressCallback = (progress: UploadProgress) => void

/**
 * Abstract interface for all cloud storage providers.
 * Every provider (S3, R2, GCS, Azure, …) must implement this.
 */
export abstract class StorageProvider {
  constructor(protected config: ProviderConfig) {}

  abstract listBuckets(): Promise<BucketInfo[]>

  abstract listObjects(
    bucket: string,
    prefix: string,
    continuationToken?: string,
    searchQuery?: string
  ): Promise<ListObjectsResult>

  abstract uploadFile(
    bucket: string,
    key: string,
    filePath: string,
    onProgress: ProgressCallback,
    contentType?: string
  ): Promise<void>

  abstract downloadFile(
    bucket: string,
    key: string,
    destPath: string,
    onProgress: ProgressCallback
  ): Promise<void>

  abstract deleteObjects(bucket: string, keys: string[]): Promise<void>

  abstract copyObject(options: CopyOptions): Promise<void>

  abstract createFolder(bucket: string, prefix: string): Promise<void>

  abstract getPresignedUrl(options: PresignedUrlOptions): Promise<string>

  abstract getObjectMetadata(bucket: string, key: string): Promise<ObjectMetadata>

  abstract updateObjectMetadata(
    bucket: string,
    key: string,
    metadata: Record<string, string>
  ): Promise<void>
}
