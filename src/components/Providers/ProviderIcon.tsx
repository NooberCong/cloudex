import React, { useEffect, useMemo, useState } from 'react'
import { Cloud, HardDrive } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ProviderType } from '../../types'

const PROVIDER_LABELS: Record<ProviderType, string> = {
  'aws-s3': 'AWS S3',
  'cloudflare-r2': 'Cloudflare R2',
  'backblaze-b2': 'Backblaze B2',
  'wasabi-s3': 'Wasabi',
  'minio-s3': 'MinIO',
  'digitalocean-spaces': 'DigitalOcean Spaces',
  'google-cloud-storage': 'Google Cloud Storage',
  'azure-blob-storage': 'Azure Blob Storage'
}

const ICON_EXTENSIONS = ['svg', 'png', 'webp', 'jpg', 'jpeg', 'gif'] as const
const ICON_BASENAME_OVERRIDES: Partial<Record<ProviderType, string[]>> = {
  'google-cloud-storage': ['google-cloud', 'google-cloud-storage']
}

const fallbackIcon = (type: ProviderType, className: string) => {
  if (type === 'aws-s3') return <Cloud className={cn(className, 'text-[#FF9900]')} />
  if (type === 'digitalocean-spaces') return <HardDrive className={cn(className, 'text-[#0080FF]')} />
  if (type === 'minio-s3') return <HardDrive className={cn(className, 'text-[#C72E49]')} />
  if (type === 'wasabi-s3') return <HardDrive className={cn(className, 'text-[#74B72E]')} />
  if (type === 'backblaze-b2') return <HardDrive className={cn(className, 'text-[#E85C33]')} />
  if (type === 'google-cloud-storage') return <HardDrive className={cn(className, 'text-[#1A73E8]')} />
  if (type === 'azure-blob-storage') return <HardDrive className={cn(className, 'text-[#0078D4]')} />
  return <HardDrive className={cn(className, 'text-[#F48120]')} />
}

export function getProviderLabel(type: ProviderType): string {
  return PROVIDER_LABELS[type]
}

interface ProviderIconProps {
  type: ProviderType
  className?: string
}

export function ProviderIcon({ type, className = 'w-4 h-4' }: ProviderIconProps) {
  const sources = useMemo(() => {
    const basenames = ICON_BASENAME_OVERRIDES[type] ?? [type]
    return basenames.flatMap((name) => ICON_EXTENSIONS.map((ext) => `/provider-icons/${name}.${ext}`))
  }, [type])
  const [sourceIndex, setSourceIndex] = useState(0)
  const wrapperClassName = cn(className, 'shrink-0 rounded-md overflow-hidden')

  useEffect(() => {
    setSourceIndex(0)
  }, [type])

  if (sourceIndex >= sources.length) {
    return <span className={wrapperClassName}>{fallbackIcon(type, className)}</span>
  }

  return (
    <span className={wrapperClassName}>
      <img
        src={sources[sourceIndex]}
        alt={`${getProviderLabel(type)} icon`}
        className="w-full h-full object-cover"
        onError={() => setSourceIndex((idx) => idx + 1)}
        draggable={false}
      />
    </span>
  )
}
