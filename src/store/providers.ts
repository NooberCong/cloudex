import { create } from 'zustand'
import type { ProviderConfig, BucketInfo } from '../types'

interface BucketState {
  buckets: BucketInfo[]
  loading: boolean
  error?: string
}

interface ProvidersState {
  providers: ProviderConfig[]
  buckets: Record<string, BucketState> // keyed by providerId
  loading: boolean
  initialized: boolean

  // Actions
  loadProviders: () => Promise<void>
  saveProvider: (config: ProviderConfig) => Promise<ProviderConfig>
  deleteProvider: (id: string) => Promise<void>
  testProvider: (config: ProviderConfig) => Promise<{ success: boolean; error?: string }>
  loadBuckets: (providerId: string) => Promise<void>
  toggleProviderExpanded: (providerId: string) => void
  expandedProviders: string[]
}

const TEST_PROVIDER_TIMEOUT_MS = 13000

export const useProvidersStore = create<ProvidersState>((set, get) => ({
  providers: [],
  buckets: {},
  loading: false,
  initialized: false,
  expandedProviders: [],

  loadProviders: async () => {
    set({ loading: true })
    try {
      const providers = await window.api.providers.list()
      set({ providers, loading: false, initialized: true })
    } catch (e) {
      set({ loading: false, initialized: true })
    }
  },

  saveProvider: async (config) => {
    const saved = await window.api.providers.save(config)
    await get().loadProviders()

    // Clear stale bucket cache for this provider after settings changes.
    set((s) => {
      const nextBuckets = { ...s.buckets }
      delete nextBuckets[saved.id]
      return { buckets: nextBuckets }
    })

    // If provider is currently expanded in the sidebar, reload buckets immediately.
    if (get().expandedProviders.includes(saved.id)) {
      await get().loadBuckets(saved.id)
    }

    return saved
  },

  deleteProvider: async (id) => {
    await window.api.providers.delete(id)
    const { buckets, expandedProviders } = get()
    const newBuckets = { ...buckets }
    delete newBuckets[id]
    set({ buckets: newBuckets, expandedProviders: expandedProviders.filter((p) => p !== id) })
    await get().loadProviders()
  },

  testProvider: async (config) => {
    return Promise.race([
      window.api.providers.test(config),
      new Promise<{ success: boolean; error?: string }>((resolve) => {
        setTimeout(() => {
          resolve({ success: false, error: 'Test connection timed out. Please verify endpoint and network.' })
        }, TEST_PROVIDER_TIMEOUT_MS)
      })
    ])
  },

  loadBuckets: async (providerId) => {
    set((s) => ({
      buckets: {
        ...s.buckets,
        [providerId]: { buckets: [], loading: true }
      }
    }))
    try {
      const buckets = await window.api.buckets.list(providerId)
      set((s) => ({
        buckets: {
          ...s.buckets,
          [providerId]: { buckets, loading: false }
        }
      }))
    } catch (e: any) {
      set((s) => ({
        buckets: {
          ...s.buckets,
          [providerId]: { buckets: [], loading: false, error: e?.message || String(e) }
        }
      }))
    }
  },

  toggleProviderExpanded: (providerId) => {
    const { expandedProviders } = get()
    if (expandedProviders.includes(providerId)) {
      set({ expandedProviders: expandedProviders.filter((p) => p !== providerId) })
    } else {
      set({ expandedProviders: [...expandedProviders, providerId] })
    }
  }
}))
