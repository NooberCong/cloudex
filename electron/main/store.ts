import Store from 'electron-store'
import type { ProviderConfig, AppPreferences } from '../../src/types'

interface StoreSchema {
  providers: ProviderConfig[]
  preferences: AppPreferences
  windowState: WindowState
}

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  maximized: boolean
}

const defaults: StoreSchema = {
  providers: [],
  preferences: {
    theme: 'system',
    defaultView: 'list',
    showHiddenFiles: false,
    confirmBeforeDelete: true,
    defaultPresignedUrlExpiry: 3600
  },
  windowState: {
    width: 1280,
    height: 800,
    maximized: true
  }
}

export const store = new Store<StoreSchema>({
  name: 'cloudex-config',
  defaults,
  // Encrypt sensitive data at rest
  encryptionKey: 'cloudex-secure-key-v1'
})

// ─── Provider helpers ─────────────────────────────────────────────────────────

export function getProviders(): ProviderConfig[] {
  return store.get('providers', [])
}

export function getProvider(id: string): ProviderConfig | undefined {
  return getProviders().find((p) => p.id === id)
}

export function saveProvider(config: ProviderConfig): void {
  const providers = getProviders()
  const idx = providers.findIndex((p) => p.id === config.id)
  if (idx >= 0) {
    providers[idx] = config
  } else {
    providers.push(config)
  }
  store.set('providers', providers)
}

export function deleteProvider(id: string): void {
  const providers = getProviders().filter((p) => p.id !== id)
  store.set('providers', providers)
}

// ─── Preferences helpers ──────────────────────────────────────────────────────

export function getPreferences(): AppPreferences {
  return store.get('preferences')
}

export function savePreferences(prefs: Partial<AppPreferences>): void {
  const current = getPreferences()
  store.set('preferences', { ...current, ...prefs })
}

// ─── Window state helpers ──────────────────────────────────────────────────────

export function getWindowState(): WindowState {
  return store.get('windowState')
}

export function saveWindowState(state: Partial<WindowState>): void {
  const current = getWindowState()
  store.set('windowState', { ...current, ...state })
}
