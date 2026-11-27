import { Check, Copy, KeyRound, PlugZap, RotateCcw, ScanLine, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useCompany } from '@/features/company/CompanyProvider'
import { formatDate, formatMoney } from '@/lib/format'
import { normalizeSupabaseUrl } from '@/lib/supabase-url'
import { cn } from '@/lib/utils'
import { useAgentKeys, useJobs, useOcrAction, useOverview, type OcrJob } from './queries'

const REPO = 'https://github.com/soonia007/thai-accounting/tree/main-jdj75c/tools/ocr-connector'

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation()
  const [done, setDone] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      {done ? t('ocr.copied') : t('ocr.copy')}
    </Button>
  )
}

const STATUS_TONE: Record<OcrJob['status'], string> = {
  queued: 'bg-muted text-muted-foreground',
  processing: 'bg-accent text-brand',
  needs_review: 'bg-warning/15 text-warning-foreground',
  done: 'bg-success/12 text-success-foreground',
  failed: 'bg-destructive/10 text-destructive-foreground',
}

/** M17: connect the OCR program (pdfstruct) running on the user's computer. */
export function OcrConnectionPage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const era = co.date_era
  const isAdmin = co.role === 'owner' || co.role === 'admin'
  const overview = useOverview(co.id)
  const keys = useAgentKeys(co.id, isAdmin)
  const jobs = useJobs(co.id)
  const action = useOcrAction(co.id)
  const [name, setName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  const ov = overview.data
  const online = !!ov?.online
  const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
  const config = newKey
    ? JSON.stringify(
        { url, key: newKey, watch_dir: t('ocr.setup.exampleFolder'), templates: null },
        null,
        2,
      )
    : ''

  const run = async (fn: string, args: Record<string, unknown>) => {
    setError(null)
    try {
      return await action.mutateAsync({ fn, args })
    } catch (e) {
      setError(e)
      return null
    }
  }
  const createKey = async () => {
    const k = await run('create_ocr_agent_key', {
      p_company_id: co.id,
      p_name: name.trim() || t('ocr.keys.defaultName'),
    })
    if (typeof k === 'string') {
      setNewKey(k)
      setName('')
    }
  }
  const activeKeys = (keys.data ?? []).filter((k) => !k.revoked_at)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader icon={ScanLine} title={t('ocr.title')} description={t('ocr.subtitle')} />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, error)}</AlertDescription>
        </Alert>
      ) : null}

      {/* Status */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-card">
          <span
            className={cn(
              'flex size-10 items-center justify-center rounded-xl',
              online ? 'bg-success/12 text-success-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            <PlugZap className="size-5" />
          </span>
          <div>
            <div className="font-semibold">
              {online ? t('ocr.status.online') : t('ocr.status.offline')}
            </div>
            <div className="text-xs text-muted-foreground">
              {ov?.agent_last_seen
                ? t('ocr.status.lastSeen', {
                    when: new Date(ov.agent_last_seen).toLocaleString(i18n.language),
                  })
                : t('ocr.status.never')}
            </div>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <div className="text-xs text-muted-foreground">{t('ocr.status.thisMonth')}</div>
          <div className="text-2xl font-semibold tabular-nums">{ov?.month_count ?? 0}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-card">
          <div className="text-xs text-muted-foreground">{t('ocr.status.waiting')}</div>
          <div className="text-2xl font-semibold tabular-nums">
            {ov?.by_status?.needs_review ?? 0}
          </div>
          <div className="text-xs text-muted-foreground">{t('ocr.status.waitingHint')}</div>
        </div>
      </section>

      {/* Setup guide */}
      {isAdmin ? (
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="font-semibold">{t('ocr.setup.title')}</h2>
          <ol className="space-y-4 text-sm">
            <li>
              <p className="font-medium">1. {t('ocr.setup.step1')}</p>
              <p className="text-muted-foreground">
                {t('ocr.setup.step1Hint')}{' '}
                <a href={REPO} target="_blank" rel="noreferrer" className="text-primary underline">
                  {t('ocr.setup.guide')}
                </a>
              </p>
            </li>
            <li className="space-y-2">
              <p className="font-medium">2. {t('ocr.setup.step2')}</p>
              <div className="flex max-w-md gap-2">
                <Input
                  aria-label={t('ocr.keys.name')}
                  placeholder={t('ocr.keys.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Button onClick={() => void createKey()} disabled={action.isPending}>
                  <KeyRound className="size-4" />
                  {t('ocr.keys.create')}
                </Button>
              </div>
              {newKey ? (
                <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
                  <p className="text-xs font-medium">{t('ocr.keys.showOnce')}</p>
                  <pre className="overflow-x-auto rounded-lg bg-card p-2 text-xs">{config}</pre>
                  <div className="flex gap-2">
                    <CopyButton text={config} />
                    <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>
                      {t('ocr.keys.hide')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
            <li>
              <p className="font-medium">3. {t('ocr.setup.step3')}</p>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-2 text-xs">
                python -m finora_ocr run
              </pre>
              <p className="text-muted-foreground">{t('ocr.setup.step3Hint')}</p>
            </li>
          </ol>
        </section>
      ) : null}

      {/* Keys */}
      {isAdmin && activeKeys.length > 0 ? (
        <section className="space-y-2 rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="font-semibold">{t('ocr.keys.title')}</h2>
          <ul className="divide-y text-sm">
            {activeKeys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="font-medium">{k.name}</span>
                <code className="text-xs text-muted-foreground">{k.key_prefix}…</code>
                <span className="flex-1 text-xs text-muted-foreground">
                  {k.last_used_at
                    ? t('ocr.status.lastSeen', {
                        when: new Date(k.last_used_at).toLocaleString(i18n.language),
                      })
                    : t('ocr.status.never')}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    window.confirm(t('ocr.keys.revokeConfirm', { name: k.name })) &&
                    void run('revoke_ocr_agent_key', { p_key_id: k.id })
                  }
                >
                  <Trash2 className="size-4" />
                  {t('ocr.keys.revoke')}
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
            <label htmlFor="ocr-threshold">{t('ocr.threshold.label')}</label>
            <select
              id="ocr-threshold"
              className="h-9 rounded-md border bg-background px-2"
              value={String(ov?.threshold ?? 0.85)}
              onChange={(e) =>
                void run('set_ocr_threshold', {
                  p_company_id: co.id,
                  p_threshold: Number(e.target.value),
                })
              }
            >
              {[0.75, 0.8, 0.85, 0.9, 0.95].map((v) => (
                <option key={v} value={String(v)}>
                  {Math.round(v * 100)}%
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">{t('ocr.threshold.hint')}</span>
          </div>
        </section>
      ) : null}

      {/* Recent jobs */}
      <section className="space-y-2 rounded-2xl border bg-card p-5 shadow-card">
        <h2 className="font-semibold">{t('ocr.jobs.title')}</h2>
        {(jobs.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('ocr.jobs.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">{t('ocr.jobs.file')}</th>
                  <th className="py-1.5 font-medium">{t('ocr.jobs.found')}</th>
                  <th className="py-1.5 text-right font-medium">{t('ocr.jobs.total')}</th>
                  <th className="py-1.5 font-medium">{t('ocr.jobs.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(jobs.data ?? []).map((j) => (
                  <tr key={j.id} className="border-t align-top">
                    <td className="py-2">
                      <div className="font-medium">{j.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {t(`ocr.source.${j.source}`)} · {formatDate(j.created_at.slice(0, 10), era)}
                      </div>
                    </td>
                    <td className="py-2 text-xs">
                      {j.result ? (
                        <>
                          <div>
                            {t(`ocr.docType.${j.result.document_type ?? 'other'}`)}{' '}
                            {j.result.document_number ?? ''}
                          </div>
                          <div className="text-muted-foreground">{j.result.seller?.name ?? ''}</div>
                        </>
                      ) : j.error ? (
                        <span className="text-destructive">{j.error}</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {j.result?.total != null ? formatMoney(j.result.total, i18n.language) : ''}
                    </td>
                    <td className="py-2">
                      <Badge variant="outline" className={cn('border-0', STATUS_TONE[j.status])}>
                        {t(`ocr.jobStatus.${j.status}`)}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      {j.status === 'failed' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void run('retry_ocr_job', { p_job_id: j.id })}
                        >
                          <RotateCcw className="size-4" />
                          {t('ocr.jobs.retry')}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t('ocr.jobs.reviewSoon')}</p>
      </section>
    </div>
  )
}
