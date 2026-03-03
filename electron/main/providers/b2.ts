import { S3Client } from '@aws-sdk/client-s3'
import type { ProviderConfig } from '../../../src/types'
import { S3Provider } from './s3'

const DEFAULT_B2_REGION = 'us-west-004'

/**
 * Backblaze B2 provider (S3-compatible).
 * Uses the S3 endpoint shape: https://s3.<region>.backblazeb2.com
 */
export class B2Provider extends S3Provider {
  constructor(config: ProviderConfig) {
    super(config)
    this.client = this.buildClient(config)
  }

  protected buildClient(config: ProviderConfig): S3Client {
    const region = (config.region || DEFAULT_B2_REGION).trim()
    const endpoint = config.endpoint?.trim() || `https://s3.${region}.backblazeb2.com`

    return new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      // Keep endpoint behavior aligned with other S3-compatible providers in this app.
      forcePathStyle: true
    })
  }
}
