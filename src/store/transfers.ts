import { create } from 'zustand'
import type { TransferItem } from '@/types'

const AUTO_CLEAR_DONE_MS = 2500
const doneCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface TransfersState {
  transfers: TransferItem[]
  isQueueOpen: boolean

  // Actions
  addTransfer: (item: Omit<TransferItem, 'status' | 'transferredBytes' | 'startedAt'>) => void
  updateProgress: (transferId: string, transferredBytes: number, totalBytes: number) => void
  completeTransfer: (transferId: string) => void
  errorTransfer: (transferId: string, error: string) => void
  removeTransfer: (transferId: string) => void
  clearCompleted: () => void
  toggleQueue: () => void
  openQueue: () => void
}

export const useTransfersStore = create<TransfersState>((set) => ({
  transfers: [],
  isQueueOpen: false,

  addTransfer: (item) => {
    const existingTimer = doneCleanupTimers.get(item.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
      doneCleanupTimers.delete(item.id)
    }
    const transfer: TransferItem = {
      ...item,
      status: 'active',
      transferredBytes: 0,
      startedAt: Date.now()
    }
    set((s) => ({ transfers: [...s.transfers, transfer], isQueueOpen: true }))
  },

  updateProgress: (transferId, transferredBytes, totalBytes) => {
    set((s) => ({
      transfers: s.transfers.map((t) => {
        if (t.id !== transferId) return t

        if (t.isGroup) {
          return {
            ...t,
            transferredBytes,
            totalBytes,
            completedItems: transferredBytes,
            totalItems: totalBytes,
            status: 'active',
            speed: undefined,
            eta: undefined
          }
        }

        const elapsed = (Date.now() - (t.startedAt ?? Date.now())) / 1000
        const speed = elapsed > 0 ? transferredBytes / elapsed : 0
        const remaining = totalBytes - transferredBytes
        const eta = speed > 0 ? remaining / speed : undefined

        return {
          ...t,
          transferredBytes,
          totalBytes,
          speed,
          eta,
          status: 'active'
        }
      })
    }))
  },

  completeTransfer: (transferId) => {
    set((s) => ({
      transfers: s.transfers.map((t) =>
        t.id === transferId
          ? {
            ...t,
            status: 'done',
            transferredBytes: t.totalBytes,
            completedItems: t.isGroup ? t.totalBytes : t.completedItems,
            totalItems: t.isGroup ? t.totalBytes : t.totalItems,
            completedAt: Date.now()
          }
          : t
      )
    }))
    const existingTimer = doneCleanupTimers.get(transferId)
    if (existingTimer) clearTimeout(existingTimer)
    const timer = setTimeout(() => {
      set((s) => ({
        transfers: s.transfers.filter((t) => t.id !== transferId || t.status !== 'done')
      }))
      doneCleanupTimers.delete(transferId)
    }, AUTO_CLEAR_DONE_MS)
    doneCleanupTimers.set(transferId, timer)
  },

  errorTransfer: (transferId, error) => {
    const existingTimer = doneCleanupTimers.get(transferId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      doneCleanupTimers.delete(transferId)
    }
    set((s) => ({
      transfers: s.transfers.map((t) =>
        t.id === transferId ? { ...t, status: 'error', error } : t
      )
    }))
  },

  removeTransfer: (transferId) => {
    const existingTimer = doneCleanupTimers.get(transferId)
    if (existingTimer) {
      clearTimeout(existingTimer)
      doneCleanupTimers.delete(transferId)
    }
    set((s) => ({ transfers: s.transfers.filter((t) => t.id !== transferId) }))
  },

  clearCompleted: () => {
    for (const [transferId, timer] of doneCleanupTimers.entries()) {
      clearTimeout(timer)
      doneCleanupTimers.delete(transferId)
    }
    set((s) => ({
      transfers: s.transfers.filter((t) => t.status !== 'done' && t.status !== 'error')
    }))
  },

  toggleQueue: () => set((s) => ({ isQueueOpen: !s.isQueueOpen })),
  openQueue: () => set({ isQueueOpen: true })
}))
