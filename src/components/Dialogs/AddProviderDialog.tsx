import React, { useEffect, useState } from 'react'
import { CheckCircle, XCircle, ChevronDown } from 'lucide-react'
import { Dialog } from '../UI/Dialog'
import { Button } from '../UI/Button'
import type { ProviderConfig, ProviderType } from '../../types'
import { useProvidersStore } from '../../store/providers'
import { useToast } from '../UI/Toast'
import { ProviderIcon, getProviderLabel } from '../Providers/ProviderIcon'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing?: ProviderConfig | null
}

type ProviderFormState = {
  name: string
  type: ProviderType
  accessKeyId: string
  secretAccessKey: string
  region: string
  endpoint: string
  accountId: string
  defaultBucket: string
}

const EMPTY: ProviderFormState = {
  name: '',
  type: 'aws-s3',
  accessKeyId: '',
  secretAccessKey: '',
  region: 'us-east-1',
  endpoint: '',
  accountId: '',
  defaultBucket: ''
}

const S3_STANDARD_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'sa-east-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-central-2',
  'eu-north-1',
  'eu-south-1',
  'eu-south-2',
  'me-south-1',
  'me-central-1',
  'af-south-1',
  'ap-south-1',
  'ap-south-2',
  'ap-east-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-southeast-3',
  'ap-southeast-4',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3'
]

const B2_STANDARD_REGIONS = [
  'us-west-004',
  'us-west-002',
  'us-east-005',
  'eu-central-003',
  'ap-southeast-001'
]

const WASABI_STANDARD_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-central-1',
  'us-west-1',
  'ca-central-1',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'ap-northeast-1',
  'ap-southeast-1'
]

const SPACES_STANDARD_REGIONS = [
  'nyc3',
  'ams3',
  'sgp1',
  'fra1',
  'tor1',
  'blr1',
  'sfo2',
  'sfo3'
]

const isR2Type = (type: ProviderType) => type === 'cloudflare-r2'
const isB2Type = (type: ProviderType) => type === 'backblaze-b2'
const isWasabiType = (type: ProviderType) => type === 'wasabi-s3'
const isMinIOType = (type: ProviderType) => type === 'minio-s3'
const isSpacesType = (type: ProviderType) => type === 'digitalocean-spaces'

const defaultRegionForType = (type: ProviderType) => {
  if (isR2Type(type)) return 'auto'
  if (isB2Type(type)) return 'us-west-004'
  if (isWasabiType(type)) return 'us-east-1'
  if (isMinIOType(type)) return 'us-east-1'
  if (isSpacesType(type)) return 'nyc3'
  return 'us-east-1'
}

export function AddProviderDialog({ open, onOpenChange, editing }: Props) {
  const { saveProvider, testProvider } = useProvidersStore()
  const toast = useToast()
  const [form, setForm] = useState<ProviderFormState>({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [regionMenuOpen, setRegionMenuOpen] = useState(false)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setTestResult(null)
    setRegionMenuOpen(false)
    setTypeMenuOpen(false)
    if (editing) {
      setForm({
        name: editing.name,
        type: editing.type,
        accessKeyId: editing.accessKeyId,
        secretAccessKey: editing.secretAccessKey,
        region: editing.region,
        endpoint: editing.endpoint || '',
        accountId: editing.accountId || '',
        defaultBucket: editing.defaultBucket || editing.allowedBuckets?.[0] || ''
      })
    } else {
      setForm({ ...EMPTY })
    }
  }, [open, editing])

  const update = (key: keyof typeof EMPTY, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setTestResult(null)
  }

  const handleTypeChange = (type: ProviderType) => {
    setForm((f) => ({
      ...f,
      type,
      region: defaultRegionForType(type),
      endpoint: '',
      accountId: type === 'cloudflare-r2' ? f.accountId : ''
    }))
    setTestResult(null)
  }

  const buildConfig = (): ProviderConfig => ({
    id: editing?.id || '',
    name: form.name.trim(),
    type: form.type,
    accessKeyId: form.accessKeyId.trim(),
    secretAccessKey: form.secretAccessKey,
    region: form.region.trim() || defaultRegionForType(form.type),
    endpoint: form.endpoint.trim() || undefined,
    accountId: form.accountId.trim() || undefined,
    defaultBucket: form.defaultBucket.trim() || undefined,
    createdAt: editing?.createdAt || 0,
    updatedAt: 0
  })

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testProvider(buildConfig())
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Provider name is required')
    if (!form.accessKeyId.trim()) return toast.error('Access Key ID is required')
    if (!form.secretAccessKey) return toast.error('Secret Access Key is required')
    if (form.type === 'cloudflare-r2' && !form.endpoint.trim() && !form.accountId.trim()) {
      return toast.error('R2 requires either Account ID or Endpoint URL')
    }

    setSaving(true)
    try {
      await saveProvider(buildConfig())
      toast.success(editing ? 'Provider updated' : 'Provider added')
      onOpenChange(false)
    } catch (e: any) {
      toast.error('Failed to save provider', e?.message)
    } finally {
      setSaving(false)
    }
  }

  const isR2 = isR2Type(form.type)
  const isB2 = isB2Type(form.type)
  const isWasabi = isWasabiType(form.type)
  const isMinIO = isMinIOType(form.type)
  const isSpaces = isSpacesType(form.type)
  const suggestedRegions = isB2
    ? B2_STANDARD_REGIONS
    : (isWasabi
      ? WASABI_STANDARD_REGIONS
      : (isSpaces ? SPACES_STANDARD_REGIONS : S3_STANDARD_REGIONS))
  const filteredRegions = suggestedRegions.filter((region) =>
    region.toLowerCase().includes(form.region.trim().toLowerCase())
  )

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit Provider' : 'Add Storage Provider'}
      description="Connect to AWS S3, Cloudflare R2, Backblaze B2, Wasabi, MinIO, or DigitalOcean Spaces"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Provider Type
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setTypeMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setTypeMenuOpen(false), 120)}
              className="w-full flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
            >
              <span className="flex items-center gap-2">
                <ProviderIcon type={form.type} className="w-3.5 h-3.5" />
                {getProviderLabel(form.type)}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>

            {typeMenuOpen && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] shadow-lg overflow-hidden p-1">
                {(['aws-s3', 'cloudflare-r2', 'backblaze-b2', 'wasabi-s3', 'minio-s3', 'digitalocean-spaces'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleTypeChange(type)
                      setTypeMenuOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                      form.type === type
                        ? 'bg-[var(--bg-selected)] text-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <ProviderIcon type={type} className="w-3.5 h-3.5" />
                    {getProviderLabel(type)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <Field label="Display Name" required>
          <input
            placeholder={
              isR2
                ? 'My R2 Storage'
                : (isB2
                  ? 'My B2 Storage'
                  : (isWasabi
                    ? 'My Wasabi Storage'
                    : (isMinIO ? 'My MinIO Storage' : (isSpaces ? 'My Spaces Storage' : 'My S3 Bucket'))))
            }
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            style={{ userSelect: 'auto' }}
          />
        </Field>

        <Field label="Access Key ID" required>
          <input
            placeholder={isR2 ? 'R2 API Token ID' : (isB2 ? 'B2 keyID' : 'AKIAIOSFODNN7EXAMPLE')}
            value={form.accessKeyId}
            onChange={(e) => update('accessKeyId', e.target.value)}
            autoComplete="off"
            style={{ userSelect: 'auto' }}
          />
        </Field>

        <Field label="Secret Access Key" required>
          <input
            type="password"
            placeholder="********************"
            value={form.secretAccessKey}
            onChange={(e) => update('secretAccessKey', e.target.value)}
            autoComplete="new-password"
            style={{ userSelect: 'auto' }}
          />
        </Field>

        {!isR2 && (
          <Field
            label="Region"
            hint={
              isB2
                ? 'Select a B2 region or type a custom value'
                : (isWasabi
                  ? 'Select a Wasabi region or type a custom value'
                  : (isMinIO
                    ? 'Set MinIO region (commonly us-east-1)'
                    : (isSpaces ? 'Select a Spaces region (e.g. nyc3)' : 'Select a standard region or type a custom value')))
            }
          >
            <div className="relative">
              <input
                placeholder={isB2 ? 'us-west-004' : (isSpaces ? 'nyc3' : 'us-east-1')}
                value={form.region}
                onFocus={() => setRegionMenuOpen(true)}
                onBlur={() => setTimeout(() => setRegionMenuOpen(false), 120)}
                onChange={(e) => {
                  update('region', e.target.value)
                  setRegionMenuOpen(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setRegionMenuOpen(false)
                }}
                style={{ userSelect: 'auto' }}
              />
              {regionMenuOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] shadow-lg overflow-hidden">
                  <div className="max-h-44 overflow-y-auto p-1">
                    {filteredRegions.length > 0 ? (
                      filteredRegions.map((region) => (
                        <button
                          key={region}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            update('region', region)
                            setRegionMenuOpen(false)
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                            form.region === region
                              ? 'bg-[var(--bg-selected)] text-[var(--accent)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {region}
                        </button>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-xs text-[var(--text-muted)]">
                        No matching regions
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Field>
        )}

        {isR2 ? (
          <>
            <Field label="Account ID (Optional)" hint="Found in the Cloudflare dashboard">
              <input
                placeholder="abc123def456..."
                value={form.accountId}
                onChange={(e) => update('accountId', e.target.value)}
                style={{ userSelect: 'auto' }}
              />
            </Field>
            <Field label="Custom Endpoint" hint="Optional - overrides Account ID endpoint">
              <input
                placeholder="https://<accountid>.r2.cloudflarestorage.com"
                value={form.endpoint}
                onChange={(e) => update('endpoint', e.target.value)}
                style={{ userSelect: 'auto' }}
              />
            </Field>
          </>
        ) : (
          <Field
            label="Custom Endpoint"
            hint={
              isB2
                ? 'Optional - defaults to s3.<region>.backblazeb2.com'
                : (isWasabi
                  ? 'Optional - defaults to s3.<region>.wasabisys.com'
                  : (isMinIO
                    ? 'Optional - defaults to http://127.0.0.1:9000'
                    : (isSpaces
                      ? 'Optional - defaults to https://<region>.digitaloceanspaces.com'
                      : 'Optional - for S3-compatible services or VPCs')))
            }
          >
            <input
              placeholder={
                isB2
                  ? 'https://s3.us-west-004.backblazeb2.com'
                  : (isWasabi
                    ? 'https://s3.us-east-1.wasabisys.com'
                    : (isMinIO
                      ? 'http://127.0.0.1:9000'
                      : (isSpaces ? 'https://nyc3.digitaloceanspaces.com' : 'https://s3.example.com')))
              }
              value={form.endpoint}
              onChange={(e) => update('endpoint', e.target.value)}
              style={{ userSelect: 'auto' }}
            />
          </Field>
        )}

        <Field
          label="Bucket Name"
          hint="Optional - if set, CloudEx uses only this bucket and skips ListAllMyBuckets"
        >
          <input
            placeholder="my-app-bucket"
            value={form.defaultBucket}
            onChange={(e) => update('defaultBucket', e.target.value)}
            style={{ userSelect: 'auto' }}
          />
        </Field>

        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
            testResult.success
              ? 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]'
              : 'bg-[var(--danger-light)] text-[var(--danger)]'
          }`}>
            {testResult.success ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{testResult.success ? 'Connection successful!' : testResult.error}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" size="sm" onClick={handleTest} loading={testing}>
            Test Connection
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving} data-dialog-confirm="true">
              {editing ? 'Save Changes' : 'Add Provider'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

function Field({
  label,
  hint,
  required,
  children
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] mb-1.5">
        {label}
        {required && <span className="text-[var(--danger)]">*</span>}
        {hint && <span className="text-[var(--text-muted)] font-normal">- {hint}</span>}
      </label>
      {children}
    </div>
  )
}
