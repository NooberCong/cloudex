import { S3Client } from '@aws-sdk/client-s3'
import type { ProviderConfig } from '../../../src/types'
import { S3Provider } from './s3'

const DEFAULT_SPACES_REGION = 'nyc3'

/**
 * DigitalOcean Spaces provider (S3-compatible).
 * Endpoint shape: https://<region>.digitaloceanspaces.com
 */
export class SpacesProvider extends S3Provider {
  constructor(config: ProviderConfig) {
    super(config)
    this.client = this.buildClient(config)
  }

  protected buildClient(config: ProviderConfig): S3Client {
    const region = (config.region || DEFAULT_SPACES_REGION).trim()
    const endpoint = config.endpoint?.trim() || `https://${region}.digitaloceanspaces.com`

    return new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      },
      // Spaces is usually used with virtual-host style.
      forcePathStyle: false
    })
  }
}
