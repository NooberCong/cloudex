import React from 'react'
import { ChevronRight, Database } from 'lucide-react'
import { buildBreadcrumbs } from '../../lib/utils'
import { useExplorerStore } from '../../store/explorer'
import { useProvidersStore } from '../../store/providers'

export function BreadCrumb() {
  const { location, navigate } = useExplorerStore()
  const { providers } = useProvidersStore()

  if (!location) return null

  const provider = providers.find((p) => p.id === location.providerId)
  const crumbs = buildBreadcrumbs(location.bucket, location.prefix)

  return (
    <nav className="flex items-center gap-0.5 px-4 h-9 border-b border-[var(--border)] overflow-x-auto shrink-0">
      {/* Provider label */}
      {provider && (
        <>
          <span className="text-xs text-[var(--text-muted)] shrink-0 flex items-center gap-1">
            <span className="font-medium text-[var(--text-secondary)]">{provider.name}</span>
          </span>
          <ChevronRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
        </>
      )}

      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1
        return (
          <React.Fragment key={crumb.prefix + idx}>
            {idx === 0 ? (
              <button
                onClick={() =>
                  navigate({ providerId: location.providerId, bucket: location.bucket, prefix: '' })
                }
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
              >
                <Database className="w-3 h-3" />
                <span className="font-medium">{crumb.label}</span>
              </button>
            ) : (
              <button
                onClick={() =>
                  !isLast &&
                  navigate({
                    providerId: location.providerId,
                    bucket: location.bucket,
                    prefix: crumb.prefix
                  })
                }
                className={`px-1.5 py-0.5 rounded text-xs transition-colors shrink-0 ${
                  isLast
                    ? 'text-[var(--text-primary)] font-medium cursor-default'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {crumb.label}
              </button>
            )}
            {!isLast && (
              <ChevronRight className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
