import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl'
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = 'md'
}: DialogProps) {
  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return
    if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return

    const target = e.target as HTMLElement
    if (target instanceof HTMLTextAreaElement) return

    const content = e.currentTarget
    const confirmBtn = content.querySelector<HTMLButtonElement>(
      'button[data-dialog-confirm="true"]:not(:disabled)'
    )
    if (!confirmBtn) return

    // If Enter is already on the confirm button itself, let the native click happen.
    if (target === confirmBtn) return

    e.preventDefault()
    confirmBtn.click()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
        />
        <DialogPrimitive.Content
          onKeyDown={handleKeyDown}
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl shadow-2xl',
            'w-[90vw] p-6',
            'animate-dialog-in',
            'focus:outline-none',
            sizeMap[size],
            className
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <DialogPrimitive.Title className="text-[15px] font-semibold text-[var(--text-primary)]">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <button className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
