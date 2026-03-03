import { S3Client } from '@aws-sdk/client-s3'
import type { ProviderConfig } from '../../../src/types'
import { S3Provider } from './s3'

const DEFAULT_WASABI_REGION = 'us-east-1'

/**
 * Wasabi provider (S3-compatible).
 * Uses endpoint shape: https://s3.<region>.wasabisys.com
 */
export class WasabiProvider extends S3Provider {
  constructor(config: ProviderConfig) {
    super(config)
    this.client = this.buildClient(config)
  }

  protected buildClient(config: ProviderConfig): S3Client {
    const region = (config.region || DEFAULT_WASABI_REGION).trim()
    const endpoint = config.endpoint?.trim() || `https://s3.${region}.wasabisys.com`

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
