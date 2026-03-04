// ─── Provider / Credential Types ────────────────────────────────────────────

export type ProviderType =
  | 'aws-s3'
  | 'cloudflare-r2'
  | 'backblaze-b2'
  | 'wasabi-s3'
  | 'minio-s3'
  | 'digitalocean-spaces'
  | 'google-cloud-storage'
  | 'azure-blob-storage'

export interface ProviderConfig {
  id: string
  name: string
  type: ProviderType
  accessKeyId: string
  secretAccessKey: string
  /** AWS/B2 region (e.g. us-east-1, us-west-004) or "auto" for R2 */
  region: string
  /** Custom endpoint URL – required for R2, optional for S3 custom endpoints */
  endpoint?: string
  /** Cloudflare account ID – used to build the R2 endpoint automatically */
  accountId?: string
  /** Optional: use only this bucket and skip account-wide bucket listing */
  defaultBucket?: string
  /** Optional: restrict which buckets are shown */
  allowedBuckets?: string[]
  createdAt: number
  updatedAt: number
}

// ─── S3 Object Types ─────────────────────────────────────────────────────────

export interface S3Object {
  key: string
  /** Display name (last path segment) */
  name: string
  /** True for zero-byte keys ending in "/" (virtual folder) */
  isFolder: boolean
  size?: number
  lastModified?: Date
  contentType?: string
  storageClass?: string
  etag?: string
}

export interface BucketInfo {
  name: string
  region?: string
  createdAt?: Date
}

export interface ListObjectsResult {
  objects: S3Object[]
  prefixes: string[]
  nextContinuationToken?: string
  isTruncated: boolean
}

// ─── Transfer Types ───────────────────────────────────────────────────────────

export type TransferStatus = 'queued' | 'active' | 'paused' | 'done' | 'error' | 'cancelled'
export type TransferDirection = 'upload' | 'download'

export interface TransferItem {
  id: string
  direction: TransferDirection
  status: TransferStatus
  /** Optional parent transfer id for hierarchical display (e.g. files under folder upload). */
  parentTransferId?: string
  /** True for virtual aggregate transfers (e.g. folder upload parent row). */
  isGroup?: boolean
  providerId: string
  bucket: string
  key: string
  /** Local filesystem path */
  localPath: string
  /** File name for display */
  fileName: string
  /** Aggregate item progress (used by group rows). */
  completedItems?: number
  totalItems?: number
  totalBytes: number
  transferredBytes: number
  /** Bytes per second */
  speed?: number
  /** Seconds remaining */
  eta?: number
  error?: string
  startedAt?: number
  completedAt?: number
}

// ─── IPC API types (must match preload/index.ts exactly) ─────────────────────

export interface UploadOptions {
  providerId: string
  bucket: string
  key: string
  filePath: string
  transferId: string
  contentType?: string
}

export interface DownloadOptions {
  providerId: string
  bucket: string
  key: string
  destPath: string
  transferId: string
}

export interface DownloadZipOptions {
  providerId: string
  bucket: string
  prefix: string
  keys: string[]
  destPath: string
  transferId: string
}

export interface CopyOptions {
  srcProviderId: string
  srcBucket: string
  srcKey: string
  destProviderId: string
  destBucket: string
  destKey: string
}

export interface ObjectMetadata {
  contentType?: string
  contentLength?: number
  lastModified?: string
  etag?: string
  storageClass?: string
  metadata?: Record<string, string>
  versionId?: string
}

export interface PresignedUrlOptions {
  providerId: string
  bucket: string
  key: string
  expiresIn: number
}

// ─── App preferences ─────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'system'
export type ViewMode = 'list' | 'grid'

export interface AppPreferences {
  theme: Theme
  defaultView: ViewMode
  showHiddenFiles: boolean
  confirmBeforeDelete: boolean
  defaultPresignedUrlExpiry: number
}
