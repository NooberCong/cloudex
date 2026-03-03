import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { Dialog } from '../UI/Dialog'
import { Button } from '../UI/Button'
import type { ProviderConfig, ProviderType } from '../../types'
import { useProvidersStore } from '../../store/providers'
import { useToast } from '../UI/Toast'

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

export function AddProviderDialog({ open, onOpenChange, editing }: Props) {
  const { saveProvider, testProvider } = useProvidersStore()
  const toast = useToast()
  const [form, setForm] = useState<ProviderFormState>({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  useEffect(() => {
    if (open) {
      setTestResult(null)
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
      region: type === 'cloudflare-r2' ? 'auto' : 'us-east-1',
      endpoint: ''
    }))
    setTestResult(null)
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const config = buildConfig()
      const result = await testProvider(config)
      setTestResult(result)
    } finally {
      setTesting(false)
    }
  }

  const buildConfig = (): ProviderConfig => ({
    id: editing?.id || '',
    name: form.name.trim(),
    type: form.type,
    accessKeyId: form.accessKeyId.trim(),
    secretAccessKey: form.secretAccessKey,
    region: form.region.trim() || (form.type === 'cloudflare-r2' ? 'auto' : 'us-east-1'),
    endpoint: form.endpoint.trim() || undefined,
    accountId: form.accountId.trim() || undefined,
    defaultBucket: form.defaultBucket.trim() || undefined,
    createdAt: editing?.createdAt || 0,
    updatedAt: 0
  })

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

  const isR2 = form.type === 'cloudflare-r2'

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit Provider' : 'Add Storage Provider'}
      description="Connect to AWS S3 or Cloudflare R2"
    >
      <div className="space-y-4">
        {/* Provider type selector */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Provider Type
          </label>
          <div className="flex gap-2">
            {(['aws-s3', 'cloudflare-r2'] as const).map((type) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  form.type === type
                    ? 'bg-[var(--accent-light)] border-[var(--accent)] text-[var(--accent)]'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                {type === 'aws-s3' ? '☁️ AWS S3' : '🔶 Cloudflare R2'}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <Field label="Display Name" required>
          <input
            placeholder={isR2 ? 'My R2 Storage' : 'My S3 Bucket'}
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            style={{ userSelect: 'auto' }}
          />
        </Field>

        {/* Access Key */}
        <Field label="Access Key ID" required>
          <input
            placeholder={isR2 ? 'R2 API Token ID' : 'AKIAIOSFODNN7EXAMPLE'}
            value={form.accessKeyId}
            onChange={(e) => update('accessKeyId', e.target.value)}
            autoComplete="off"
            style={{ userSelect: 'auto' }}
          />
        </Field>

        {/* Secret Key */}
        <Field label="Secret Access Key" required>
          <input
            type="password"
            placeholder="••••••••••••••••••••"
            value={form.secretAccessKey}
            onChange={(e) => update('secretAccessKey', e.target.value)}
            autoComplete="new-password"
            style={{ userSelect: 'auto' }}
          />
        </Field>

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
            <Field label="Custom Endpoint" hint="Optional – overrides Account ID endpoint">
              <input
                placeholder="https://<accountid>.r2.cloudflarestorage.com"
                value={form.endpoint}
                onChange={(e) => update('endpoint', e.target.value)}
                style={{ userSelect: 'auto' }}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Region">
              <input
                placeholder="us-east-1"
                value={form.region}
                onChange={(e) => update('region', e.target.value)}
                style={{ userSelect: 'auto' }}
              />
            </Field>
            <Field label="Custom Endpoint" hint="Optional – for S3-compatible services or VPCs">
              <input
                placeholder="https://s3.example.com"
                value={form.endpoint}
                onChange={(e) => update('endpoint', e.target.value)}
                style={{ userSelect: 'auto' }}
              />
            </Field>
          </>
        )}

        <Field
          label="Bucket Name"
          hint="Optional – if set, CloudEx uses only this bucket and skips ListAllMyBuckets"
        >
          <input
            placeholder="my-app-bucket"
            value={form.defaultBucket}
            onChange={(e) => update('defaultBucket', e.target.value)}
            style={{ userSelect: 'auto' }}
          />
        </Field>

        {/* Test result */}
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

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
          <Button variant="ghost" size="sm" onClick={handleTest} loading={testing}>
            Test Connection
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} loading={saving}>
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
        {hint && <span className="text-[var(--text-muted)] font-normal">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}
