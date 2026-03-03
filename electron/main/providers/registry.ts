import type { ProviderConfig } from '../../../src/types'
import { StorageProvider } from './base'
import { S3Provider } from './s3'
import { R2Provider } from './r2'

// Cache provider instances so we don't recreate clients on every call
const cache = new Map<string, StorageProvider>()

export function getProviderInstance(config: ProviderConfig): StorageProvider {
  const cached = cache.get(config.id)
  // Invalidate cache if the config was updated
  if (cached && (config as any)._cacheKey === config.updatedAt) {
    return cached
  }

  const instance = createProvider(config)
  ;(config as any)._cacheKey = config.updatedAt
  cache.set(config.id, instance)
  return instance
}

function createProvider(config: ProviderConfig): StorageProvider {
  switch (config.type) {
    case 'aws-s3':
      return new S3Provider(config)
    case 'cloudflare-r2':
      return new R2Provider(config)
    default:
      throw new Error(`Unknown provider type: ${(config as any).type}`)
  }
}

export function invalidateProvider(id: string): void {
  cache.delete(id)
}
