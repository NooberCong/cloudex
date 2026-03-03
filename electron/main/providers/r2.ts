import { S3Client } from '@aws-sdk/client-s3'
import type { ProviderConfig, BucketInfo } from '../../../src/types'
import { S3Provider } from './s3'

/**
 * Cloudflare R2 provider.
 * R2 is fully S3-compatible; we just override the client construction
 * to set the R2 endpoint automatically from the accountId.
 */
export class R2Provider extends S3Provider {
  constructor(config: ProviderConfig) {
    super(config)
    // Rebuild client with R2 endpoint
    this.client = this.buildClient(config)
  }

  protected buildClient(config: ProviderConfig): S3Client {
    const endpoint =
      config.endpoint ||
      (config.accountId
        ? `https://${config.accountId}.r2.cloudflarestorage.com`
        : undefined)

    if (!endpoint) {
      throw new Error(
        'Cloudflare R2 requires either an endpoint URL or an Account ID.'
      )
    }

    return new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      // R2 requires path-style addressing
      forcePathStyle: false
    })
  }

  /**
   * R2 doesn't support ListBuckets with the standard S3 response the same way,
   * but @aws-sdk/client-s3 works fine. Override to provide a nicer response.
   */
  async listBuckets(): Promise<BucketInfo[]> {
    return super.listBuckets()
  }
}
