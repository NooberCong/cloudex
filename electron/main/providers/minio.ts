import { S3Client } from '@aws-sdk/client-s3'
import type { ProviderConfig } from '../../../src/types'
import { S3Provider } from './s3'

const DEFAULT_MINIO_REGION = 'us-east-1'
const DEFAULT_MINIO_ENDPOINT = 'http://127.0.0.1:9000'

/**
 * MinIO provider (S3-compatible).
 * Uses local endpoint by default but can point to any MinIO deployment.
 */
export class MinIOProvider extends S3Provider {
  constructor(config: ProviderConfig) {
    super(config)
    this.client = this.buildClient(config)
  }

  protected buildClient(config: ProviderConfig): S3Client {
    const region = (config.region || DEFAULT_MINIO_REGION).trim()
    const endpoint = config.endpoint?.trim() || DEFAULT_MINIO_ENDPOINT

    return new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      forcePathStyle: true
    })
  }
}
