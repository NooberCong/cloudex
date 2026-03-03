import { create } from 'zustand'
import type { S3Object, ViewMode } from '../types'

export interface ExplorerLocation {
  providerId: string
  bucket: string
  prefix: string
}

type SortField = 'name' | 'size' | 'lastModified'
type SortDir = 'asc' | 'desc'

interface ExplorerState {
  location: ExplorerLocation | null
  backStack: ExplorerLocation[]
  forwardStack: ExplorerLocation[]
  objects: S3Object[]
  loading: boolean
  error: string | null
  selectedKeys: string[]
  searchQuery: string
  viewMode: ViewMode
  sortField: SortField
  sortDir: SortDir
  nextContinuationToken?: string
  isTruncated: boolean
  // clipboard for copy/move
  clipboard: { action: 'copy' | 'move'; keys: string[]; location: ExplorerLocation } | null

  // Actions
  navigate: (location: ExplorerLocation) => Promise<void>
  navigateBack: () => Promise<void>
  navigateForward: () => Promise<void>
  pruneHistoryPaths: (providerId: string, bucket: string, prefixes: string[]) => void
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
  setSearch: (q: string) => Promise<void>
  setViewMode: (mode: ViewMode) => void
  setSort: (field: SortField, dir?: SortDir) => void
  selectKey: (key: string, multi?: boolean, range?: boolean) => void
  selectAll: () => void
  clearSelection: () => void
  setClipboard: (action: 'copy' | 'move', keys: string[]) => void
  clearClipboard: () => void
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  location: null,
  backStack: [],
  forwardStack: [],
  objects: [],
  loading: false,
  error: null,
  selectedKeys: [],
  searchQuery: '',
  viewMode: 'list',
  sortField: 'name',
  sortDir: 'asc',
  isTruncated: false,
  clipboard: null,

  navigate: async (location) => {
    const { location: current, backStack } = get()
    const isSameLocation =
      !!current &&
      current.providerId === location.providerId &&
      current.bucket === location.bucket &&
      current.prefix === location.prefix

    if (current && !isSameLocation) {
      set({ backStack: [...backStack, current], forwardStack: [] })
    }

    set({ location, loading: true, error: null, selectedKeys: [], searchQuery: '' })
    try {
      const result = await window.api.objects.list(
        location.providerId,
        location.bucket,
        location.prefix
      )
      set({
        objects: result.objects,
        loading: false,
        nextContinuationToken: result.nextContinuationToken,
        isTruncated: result.isTruncated
      })
    } catch (e: any) {
      set({ loading: false, error: e?.message || String(e) })
    }
  },

  refresh: async () => {
    const { location, searchQuery } = get()
    if (!location) return
    set({ loading: true, error: null })
    try {
      const result = await window.api.objects.list(
        location.providerId,
        location.bucket,
        location.prefix,
        undefined,
        searchQuery || undefined
      )
      set({
        objects: result.objects,
        loading: false,
        nextContinuationToken: result.nextContinuationToken,
        isTruncated: result.isTruncated
      })
    } catch (e: any) {
      set({ loading: false, error: e?.message || String(e) })
    }
  },

  loadMore: async () => {
    const { location, objects, nextContinuationToken, isTruncated, searchQuery } = get()
    if (!location || !isTruncated || !nextContinuationToken) return
    try {
      const result = await window.api.objects.list(
        location.providerId,
        location.bucket,
        location.prefix,
        nextContinuationToken,
        searchQuery || undefined
      )
      set({
        objects: [...objects, ...result.objects],
        nextContinuationToken: result.nextContinuationToken,
        isTruncated: result.isTruncated
      })
    } catch (e: any) {
      set({ error: e?.message || String(e) })
    }
  },

  setSearch: async (q) => {
    const query = q.trim()
    set({ searchQuery: q })
    const { location } = get()
    if (!location) return

    set({ loading: true, error: null })
    try {
      const result = await window.api.objects.list(
        location.providerId,
        location.bucket,
        location.prefix,
        undefined,
        query || undefined
      )
      set({
        objects: result.objects,
        loading: false,
        nextContinuationToken: result.nextContinuationToken,
        isTruncated: result.isTruncated
      })
    } catch (e: any) {
      set({ loading: false, error: e?.message || String(e) })
    }
  },

  navigateBack: async () => {
    const { location, backStack, forwardStack } = get()
    if (!location || backStack.length === 0) return
    const target = backStack[backStack.length - 1]
    const nextBack = backStack.slice(0, -1)
    set({
      backStack: nextBack,
      forwardStack: [location, ...forwardStack],
      location: target,
      loading: true,
      error: null,
      selectedKeys: [],
      searchQuery: ''
    })
    try {
      const result = await window.api.objects.list(
        target.providerId,
        target.bucket,
        target.prefix
      )
      set({
        objects: result.objects,
        loading: false,
        nextContinuationToken: result.nextContinuationToken,
        isTruncated: result.isTruncated
      })
    } catch (e: any) {
      set({ loading: false, error: e?.message || String(e) })
    }
  },

  navigateForward: async () => {
    const { location, backStack, forwardStack } = get()
    if (!location || forwardStack.length === 0) return
    const target = forwardStack[0]
    const nextForward = forwardStack.slice(1)
    set({
      backStack: [...backStack, location],
      forwardStack: nextForward,
      location: target,
      loading: true,
      error: null,
      selectedKeys: [],
      searchQuery: ''
    })
    try {
      const result = await window.api.objects.list(
        target.providerId,
        target.bucket,
        target.prefix
      )
      set({
        objects: result.objects,
        loading: false,
        nextContinuationToken: result.nextContinuationToken,
        isTruncated: result.isTruncated
      })
    } catch (e: any) {
      set({ loading: false, error: e?.message || String(e) })
    }
  },

  pruneHistoryPaths: (providerId, bucket, prefixes) => {
    const normalized = prefixes
      .map((p) => p || '')
      .filter(Boolean)
      .map((p) => (p.endsWith('/') ? p : `${p}/`))
    if (normalized.length === 0) return

    const isInvalid = (loc: ExplorerLocation) => {
      if (loc.providerId !== providerId || loc.bucket !== bucket) return false
      return normalized.some((prefix) => loc.prefix === prefix || loc.prefix.startsWith(prefix))
    }

    const { location, backStack, forwardStack } = get()
    const nextLocation = location && isInvalid(location) ? null : location

    set({
      location: nextLocation,
      backStack: backStack.filter((loc) => !isInvalid(loc)),
      forwardStack: forwardStack.filter((loc) => !isInvalid(loc))
    })
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setSort: (field, dir) => {
    const { sortField, sortDir } = get()
    set({
      sortField: field,
      sortDir: dir ?? (sortField === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc')
    })
  },

  selectKey: (key, multi = false, range = false) => {
    const { selectedKeys, objects } = get()
    if (range) {
      const allKeys = objects.map((o) => o.key)
      const lastSelected = selectedKeys[selectedKeys.length - 1]
      const lastIdx = lastSelected ? allKeys.indexOf(lastSelected) : 0
      const currIdx = allKeys.indexOf(key)
      const [from, to] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx]
      const rangeKeys = allKeys.slice(from, to + 1)
      const merged = [...new Set([...selectedKeys, ...rangeKeys])]
      set({ selectedKeys: merged })
    } else if (multi) {
      if (selectedKeys.includes(key)) {
        set({ selectedKeys: selectedKeys.filter((k) => k !== key) })
      } else {
        set({ selectedKeys: [...selectedKeys, key] })
      }
    } else {
      if (selectedKeys.length === 1 && selectedKeys[0] === key) {
        set({ selectedKeys: [] })
      } else {
        set({ selectedKeys: [key] })
      }
    }
  },

  selectAll: () => {
    const { objects } = get()
    set({ selectedKeys: objects.map((o) => o.key) })
  },

  clearSelection: () => set({ selectedKeys: [] }),

  setClipboard: (action, keys) => {
    const { location } = get()
    if (!location) return
    set({ clipboard: { action, keys, location } })
  },

  clearClipboard: () => set({ clipboard: null })
}))

// Derived selector: filtered + sorted objects
export function selectVisibleObjects(state: ExplorerState): S3Object[] {
  const { objects, sortField, sortDir } = state

  let result = objects

  result = [...result].sort((a, b) => {
    // Folders always first
    if (a.isFolder && !b.isFolder) return -1
    if (!a.isFolder && b.isFolder) return 1

    let cmp = 0
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name)
    } else if (sortField === 'size') {
      cmp = (a.size ?? 0) - (b.size ?? 0)
    } else if (sortField === 'lastModified') {
      cmp = (a.lastModified?.getTime() ?? 0) - (b.lastModified?.getTime() ?? 0)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  return result
}
