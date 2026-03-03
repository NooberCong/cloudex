import React, { createContext, useContext, useState, useCallback } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-[var(--success)]" />,
  error:   <XCircle className="w-4 h-4 text-[var(--danger)]" />,
  warning: <AlertCircle className="w-4 h-4 text-[var(--warning)]" />,
  info:    <Info className="w-4 h-4 text-[var(--accent)]" />
}

const TOAST_DURATION_MS: Record<ToastType, number> = {
  success: 2200,
  info: 2200,
  warning: 2600,
  // Effectively persistent until manually dismissed.
  error: 2147483647
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2)
    setToasts((prev) => [...prev, { ...opts, id }])
  }, [])

  const ctx: ToastContextValue = {
    toast: addToast,
    success: (title, description) => addToast({ type: 'success', title, description }),
    error:   (title, description) => addToast({ type: 'error',   title, description }),
    warning: (title, description) => addToast({ type: 'warning', title, description }),
    info:    (title, description) => addToast({ type: 'info',    title, description })
  }

  return (
    <ToastContext.Provider value={ctx}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            duration={TOAST_DURATION_MS[t.type]}
            onOpenChange={(open) => {
              if (!open) setToasts((prev) => prev.filter((x) => x.id !== t.id))
            }}
            defaultOpen
            className={cn(
              'flex items-start gap-3 px-4 py-3.5 rounded-xl shadow-lg border',
              'bg-[var(--bg-primary)] border-[var(--border)]',
              'animate-slide-up',
              'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
              'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]'
            )}
          >
            <span className="mt-0.5 shrink-0">{icons[t.type]}</span>
            <div className="flex-1 min-w-0">
              <ToastPrimitive.Title className="text-[15px] font-semibold leading-5 text-[var(--text-primary)]">
                {t.title}
              </ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="text-sm leading-5 text-[var(--text-secondary)] mt-1">
                  {t.description}
                </ToastPrimitive.Description>
              )}
              {t.actionLabel && t.onAction && (
                <button
                  onClick={() => {
                    t.onAction?.()
                    setToasts((prev) => prev.filter((x) => x.id !== t.id))
                  }}
                  className="mt-2 text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  {t.actionLabel}
                </button>
              )}
            </div>
            <ToastPrimitive.Close asChild>
              <button className="shrink-0 mt-0.5 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2.5 w-96 max-w-[calc(100vw-2rem)] z-[9999] outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
