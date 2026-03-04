import { S3Client } from '@aws-sdk/client-s3'
import type { ProviderConfig, BucketInfo } from '../../../src/types'
import { S3Provider } from './s3'

const DEFAULT_GCS_REGION = 'us-east-1'
const DEFAULT_GCS_ENDPOINT = 'https://storage.googleapis.com'

/**
 * Google Cloud Storage provider via XML API (S3-compatible).
 * Requires HMAC access key + secret.
 */
export class GCSProvider extends S3Provider {
  constructor(config: ProviderConfig) {
    super(config)
    this.client = this.buildClient(config)
  }

  protected buildClient(config: ProviderConfig): S3Client {
    const region = (config.region || DEFAULT_GCS_REGION).trim()
    const endpoint = config.endpoint?.trim() || DEFAULT_GCS_ENDPOINT

    return new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      // Path-style works reliably for bucket names with dots.
      forcePathStyle: true
    })
  }

  async listBuckets(): Promise<BucketInfo[]> {
    throw new Error(
      'Google Cloud Storage in CloudEx requires Bucket Name (bucket-scoped mode). Set Bucket Name and retry.'
    )
  }
}
