import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Plus, Scale, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatedMoney } from '@/components/AnimatedNumber'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useAccounts, useMappings } from '@/features/accounts/queries'
import type { Account } from '@/features/accounts/tree'
import { useCompany } from '@/features/company/CompanyProvider'
import { StatusBadge } from '@/features/documents/DocumentsListPage'
import { VoidDialog } from '@/features/documents/VoidDialog'
import { useFocusTracking } from '@/features/posting/focus'
import {
  PostedJournal,
  PostingPreview,
  PostingPreviewSheet,
} from '@/features/posting/PostingPreview'
import { PreviewFocusProvider } from '@/features/posting/PreviewFocusProvider'
import { usePostedJournal, type SimResult } from '@/features/posting/simulation'
import { formatDate, formatMoney, todayBangkok } from '@/lib/format'
import { canEditFinanceSetup } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  emptyJournalLine,
  journalBalance,
  journalPayload,
  toSatang,
  type JournalLineForm,
} from './journal-math'
import { JOURNAL_TEMPLATES, journalsKey, useJournal } from './queries'

interface JournalForm {
  entry_date: string
  memo: string
  reference: string
  lines: JournalLineForm[]
}

const blank = (): JournalForm => ({
  entry_date: todayBangkok(),
  memo: '',
  reference: '',
  lines: [emptyJournalLine(), emptyJournalLine()],
})

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const

/** Live preview from the engine (same validation as posting); debounced, never writes. */
function useJournalSimulation(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload)
  const [key, setKey] = useState(json)
  useEffect(() => {
    const id = setTimeout(() => setKey(json), 300)
    return () => clearTimeout(id)
  }, [json])
  return useQuery({
    queryKey: ['simulate-journal', key],
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<SimResult> => {
      const { data, error } = await supabase.rpc('simulate_manual_journal', {
        p_payload: JSON.parse(key),
      })
      if (error) throw error
      return data as unknown as SimResult
    },
  })
}

export function JournalEntryPage() {
  const { id } = useParams()
  const journal = useJournal(id)
  if (id && journal.isLoading) return <p className="text-sm text-muted-foreground">…</p>
  if (id && journal.data && journal.data.status !== 'draft') {
    return <PostedJournalView id={id} />
  }
  const initial: JournalForm = journal.data
    ? {
        entry_date: journal.data.entry_date,
        memo: journal.data.memo ?? '',
        reference: journal.data.reference ?? '',
        lines: [
          ...journal.data.lines.map((l) => ({
            account_id: l.account_id ?? '',
            description: l.description ?? '',
            debit: Number(l.debit) ? String(Number(l.debit)) : '',
            credit: Number(l.credit) ? String(Number(l.credit)) : '',
          })),
          emptyJournalLine(),
        ],
      }
    : blank()
  return (
    <PreviewFocusProvider>
      <JournalEditor key={id ?? 'new'} id={id} initial={initial} />
    </PreviewFocusProvider>
  )
}

function AccountSelect({
  value,
  onChange,
  accounts,
  locked,
  name,
}: {
  value: string
  onChange: (v: string) => void
  accounts: Account[]
  locked: Set<string>
  name: string
}) {
  const { t, i18n } = useTranslation()
  const label = (a: Account) =>
    `${a.code} ${i18n.language === 'en' ? a.name_en || a.name_th : a.name_th}`
  return (
    <select
      name={name}
      aria-label={t('journal.account')}
      className={cn(
        'h-10 w-full min-w-0 rounded-xl border bg-card pr-9 pl-3 text-sm shadow-xs',
        !value && 'text-muted-foreground',
      )}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{t('journal.chooseAccount')}</option>
      {TYPE_ORDER.map((type) => {
        const list = accounts.filter(
          (a) => a.type === type && !a.is_group && (a.is_active || a.id === value),
        )
        if (!list.length) return null
        return (
          <optgroup key={type} label={t(`accounts.types.${type}`)}>
            {list.map((a) => (
              <option key={a.id} value={a.id} disabled={locked.has(a.id)}>
                {label(a)}
                {locked.has(a.id) ? ` — ${t('journal.viaDocuments')}` : ''}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

function JournalEditor({ id, initial }: { id?: string; initial: JournalForm }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const companyId = current!.id
  const canEdit = canEditFinanceSetup(current?.role)
  const { data: accounts = [] } = useAccounts(companyId)
  const { data: mappings } = useMappings(companyId)
  const [form, setForm] = useState<JournalForm>(initial)
  const focusTracking = useFocusTracking()

  // D9: receivables / payables move only through documents
  const locked = useMemo(
    () =>
      new Set<string>([mappings?.get('AR'), mappings?.get('AP')].filter((x): x is string => !!x)),
    [mappings],
  )
  const balance = journalBalance(form.lines)
  const payload = journalPayload(companyId, form, id)
  const sim = useJournalSimulation(payload)

  const setLine = (i: number, patch: Partial<JournalLineForm>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }))
  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, emptyJournalLine()] }))
  const removeLine = (i: number) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.length > 2 ? f.lines.filter((_, j) => j !== i) : f.lines,
    }))

  /** Put the difference on the side that is short: first empty row, or a new one. */
  const fillDifference = () => {
    const diff = balance.difference
    if (diff === 0) return
    const patch: Partial<JournalLineForm> =
      diff > 0
        ? { credit: Math.abs(diff).toFixed(2), debit: '' }
        : { debit: Math.abs(diff).toFixed(2), credit: '' }
    setForm((f) => {
      const empty = f.lines.findIndex((l) => !toSatang(l.debit) && !toSatang(l.credit))
      if (empty >= 0) {
        return { ...f, lines: f.lines.map((l, j) => (j === empty ? { ...l, ...patch } : l)) }
      }
      return { ...f, lines: [...f.lines, { ...emptyJournalLine(), ...patch }] }
    })
  }

  const applyTemplate = (key: (typeof JOURNAL_TEMPLATES)[number]['key']) => {
    const tpl = JOURNAL_TEMPLATES.find((x) => x.key === key)!
    const byCode = new Map(accounts.map((a) => [a.code, a.id]))
    setForm((f) => ({
      ...f,
      memo: f.memo || t(`journal.templates.${key}`),
      lines: [
        ...tpl.lines.map((l) => ({ ...emptyJournalLine(), account_id: byCode.get(l.code) ?? '' })),
      ],
    }))
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: journalsKey(companyId) })
  const save = useMutation({
    mutationFn: async ({ post }: { post: boolean }) => {
      const { data: jid, error } = await supabase.rpc('save_manual_journal', { p_payload: payload })
      if (error) throw error
      if (post) {
        const { error: pErr } = await supabase.rpc('post_manual_journal', { p_id: jid })
        if (pErr) {
          if (!id) navigate(`/accounting/journal/${jid}`, { replace: true })
          throw pErr
        }
      }
      return jid
    },
    onSuccess: async (jid) => {
      await refresh()
      await queryClient.invalidateQueries({ queryKey: ['manual-journal', jid] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(`/accounting/journal/${jid}`, { replace: true })
    },
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('manual_journals').delete().eq('id', id!)
      if (error) throw error
    },
    onSuccess: async () => {
      await refresh()
      navigate('/accounting/journal')
    },
  })

  const isBlank = form.lines.every((l) => !l.account_id && !l.debit && !l.credit)

  return (
    <div className="flex flex-col gap-4 pb-28 md:pb-0">
      <PageHeader
        backTo="/accounting/journal"
        section={t('nav.accounting')}
        title={t('journal.entry')}
        badges={<StatusBadge status="draft" />}
        description={t('pageInfo.journalEntry')}
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem] 2xl:grid-cols-[minmax(0,1fr)_36rem]">
        <div className="flex min-w-0 flex-col gap-4" {...focusTracking}>
          {save.error && (
            <Alert variant="destructive">
              <AlertDescription>{dbErrorMessage(t, save.error)}</AlertDescription>
            </Alert>
          )}

          {isBlank && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-brand/30 bg-accent/40 p-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-brand-strong">
                <Sparkles className="size-4 text-brand" />
                {t('journal.quickStart')}
              </span>
              {JOURNAL_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => applyTemplate(tpl.key)}
                  className="h-8 cursor-pointer rounded-full border bg-card px-3 text-xs font-medium shadow-xs transition-all hover:-translate-y-px hover:border-brand hover:text-brand-strong"
                >
                  {t(`journal.templates.${tpl.key}`)}
                </button>
              ))}
            </div>
          )}

          <Card className="py-4 transition-shadow duration-300 focus-within:ring-2 focus-within:ring-finora-mint/60">
            <CardContent className="grid gap-4 px-4 sm:grid-cols-[12rem_minmax(0,1fr)_12rem]">
              <div className="grid gap-2">
                <Label htmlFor="j-date">{t('docs.date')}</Label>
                <Input
                  id="j-date"
                  name="doc_date"
                  type="date"
                  value={form.entry_date}
                  onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="j-memo">{t('journal.memo')}</Label>
                <Input
                  id="j-memo"
                  name="notes"
                  placeholder={t('journal.memoPlaceholder')}
                  value={form.memo}
                  onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="j-ref">{t('docs.reference')}</Label>
                <Input
                  id="j-ref"
                  name="reference"
                  value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <div className="@container">
              <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_8.5rem_8.5rem_2.5rem] gap-2 border-b bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground @2xl:grid">
                <span>{t('journal.account')}</span>
                <span>{t('lines.description')}</span>
                <span className="text-right">{t('preview.debit')}</span>
                <span className="text-right">{t('preview.credit')}</span>
                <span />
              </div>
              <ol className="flex flex-col">
                {form.lines.map((l, i) => (
                  <li
                    key={i}
                    className="group relative grid grid-cols-2 gap-2 border-b px-4 py-3 transition-colors duration-300 focus-within:bg-finora-mint/[0.06] focus-within:shadow-[inset_3px_0_0_var(--finora-mint)] @2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_8.5rem_8.5rem_2.5rem] @2xl:items-center"
                  >
                    <span className="pointer-events-none absolute top-1 right-3 hidden rounded-full bg-finora-mint px-2 py-px text-[10px] font-semibold text-[#003d35] group-focus-within:inline-flex @2xl:hidden">
                      {t('focus.lineBadge', { line: i + 1 })}
                    </span>
                    <div className="col-span-2 @2xl:col-span-1">
                      <AccountSelect
                        name={`jl.${i}.account_id`}
                        value={l.account_id}
                        onChange={(v) => setLine(i, { account_id: v })}
                        accounts={accounts}
                        locked={locked}
                      />
                    </div>
                    <Input
                      name={`jl.${i}.description`}
                      className="col-span-2 @2xl:col-span-1"
                      placeholder={t('lines.description')}
                      value={l.description}
                      onChange={(e) => setLine(i, { description: e.target.value })}
                    />
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground @2xl:block">
                      <span className="@2xl:sr-only">{t('preview.debit')}</span>
                      <Input
                        name={`jl.${i}.debit`}
                        inputMode="decimal"
                        className="text-right tabular-nums"
                        placeholder="0.00"
                        value={l.debit}
                        onChange={(e) =>
                          setLine(i, {
                            debit: e.target.value,
                            ...(toSatang(e.target.value) ? { credit: '' } : {}),
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground @2xl:block">
                      <span className="@2xl:sr-only">{t('preview.credit')}</span>
                      <Input
                        name={`jl.${i}.credit`}
                        inputMode="decimal"
                        className="text-right tabular-nums"
                        placeholder="0.00"
                        value={l.credit}
                        onChange={(e) =>
                          setLine(i, {
                            credit: e.target.value,
                            ...(toSatang(e.target.value) ? { debit: '' } : {}),
                          })
                        }
                      />
                    </label>
                    <div className="col-span-2 flex justify-end @2xl:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('journal.removeLine')}
                        disabled={form.lines.length <= 2}
                        onClick={() => removeLine(i)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="px-4 py-3">
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="size-4" />
                  {t('lines.add')}
                </Button>
              </div>

              {/* Live balance bar */}
              <div
                className={cn(
                  'grid grid-cols-2 items-center gap-3 border-t px-4 py-3.5 transition-colors duration-500 @2xl:grid-cols-[minmax(0,2.3fr)_8.5rem_8.5rem_2.5rem]',
                  balance.balanced
                    ? 'bg-success/[0.07]'
                    : balance.used
                      ? 'bg-warning/[0.08]'
                      : 'bg-muted/40',
                )}
              >
                <div className="col-span-2 flex flex-wrap items-center gap-2 @2xl:col-span-1">
                  <Scale
                    className={cn(
                      'size-4',
                      balance.balanced ? 'text-success' : 'text-warning-foreground',
                    )}
                  />
                  {balance.balanced ? (
                    <span className="text-sm font-semibold text-success-foreground">
                      {t('journal.balanced')}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-warning-foreground">
                        {balance.used
                          ? t('journal.difference', {
                              amount: formatMoney(Math.abs(balance.difference), i18n.language),
                            })
                          : t('journal.startTyping')}
                      </span>
                      {balance.difference !== 0 && (
                        <Button
                          type="button"
                          size="xs"
                          variant="secondary"
                          onClick={fillDifference}
                        >
                          <Wand2 className="size-3" />
                          {t('journal.fillDifference')}
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground @2xl:hidden">
                    {t('preview.debit')}
                  </div>
                  <AnimatedMoney
                    value={balance.debit}
                    lang={i18n.language}
                    className="font-semibold"
                  />
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground @2xl:hidden">
                    {t('preview.credit')}
                  </div>
                  <AnimatedMoney
                    value={balance.credit}
                    lang={i18n.language}
                    className="font-semibold"
                  />
                </div>
              </div>
            </div>
          </Card>

          {canEdit && (
            <div className="flex flex-wrap justify-end gap-2">
              {id && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(t('docs.confirmDeleteDraft'))) remove.mutate()
                  }}
                >
                  {t('docs.deleteDraft')}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => save.mutate({ post: false })}
              >
                {t('docs.saveDraft')}
              </Button>
              <Button
                type="button"
                disabled={save.isPending || !balance.balanced}
                onClick={() => {
                  if (window.confirm(t('journal.confirmPost'))) save.mutate({ post: true })
                }}
              >
                {t('docs.post')}
              </Button>
            </div>
          )}
        </div>

        <PostingPreview result={sim.data} isFetching={sim.isFetching} error={sim.error} />
      </div>
      <PostingPreviewSheet result={sim.data} isFetching={sim.isFetching} error={sim.error} />
    </div>
  )
}

function PostedJournalView({ id }: { id: string }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const { data: j } = useJournal(id)
  const { data: accounts = [] } = useAccounts(current!.id)
  const journal = usePostedJournal({ manualJournalId: id }, true)
  const [voidOpen, setVoidOpen] = useState(false)
  if (!j) return null
  const accountOf = new Map(accounts.map((a) => [a.id, a]))
  const total = j.lines.reduce((s, l) => s + Number(l.debit), 0)

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        backTo="/accounting/journal"
        section={`${t('nav.accounting')} · ${t('journal.entry')}`}
        title={<span className="font-mono">{j.number}</span>}
        badges={<StatusBadge status={j.status} />}
        description={j.memo}
        actions={
          j.status === 'posted' &&
          canEditFinanceSetup(current?.role) && (
            <ActionGroup label={t('actionGroups.manage')}>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setVoidOpen(true)}
              >
                <Ban className="size-4" />
                {t('docs.void')}
              </Button>
            </ActionGroup>
          )
        }
      />
      {j.status === 'voided' && (
        <Alert>
          <AlertDescription>
            {t('docs.voidedNote', { reason: j.void_reason ?? '' })}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem] 2xl:grid-cols-[minmax(0,1fr)_36rem]">
        <Card className="py-4">
          <CardContent className="flex flex-col gap-4 px-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 sm:grid-cols-4">
              {[
                [t('docs.date'), formatDate(j.entry_date, current!.date_era)],
                [t('docs.reference'), j.reference || '—'],
                [t('journal.lines'), String(j.lines.length)],
                [t('totals.total'), formatMoney(total, i18n.language)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="font-semibold">{v}</div>
                </div>
              ))}
            </div>
            {j.memo && <p className="text-muted-foreground">{j.memo}</p>}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-left font-medium">{t('journal.account')}</th>
                  <th className="py-2 text-right font-medium">{t('preview.debit')}</th>
                  <th className="py-2 text-right font-medium">{t('preview.credit')}</th>
                </tr>
              </thead>
              <tbody>
                {j.lines.map((l) => {
                  const a = l.account_id ? accountOf.get(l.account_id) : undefined
                  return (
                    <tr key={l.line_no} className="border-b border-border/60">
                      <td className={cn('py-2', Number(l.credit) > 0 && 'pl-5')}>
                        <span className="font-mono text-xs text-muted-foreground">{a?.code}</span>{' '}
                        {a ? (i18n.language === 'en' ? a.name_en || a.name_th : a.name_th) : ''}
                        {l.description && (
                          <span className="block text-xs text-muted-foreground">
                            {l.description}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {Number(l.debit) ? formatMoney(l.debit, i18n.language) : ''}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {Number(l.credit) ? formatMoney(l.credit, i18n.language) : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <div>{journal.data && <PostedJournal entries={journal.data} />}</div>
      </div>

      <VoidDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        target={{ manualJournalId: id }}
        number={j.number}
        onVoided={() => {
          void queryClient.invalidateQueries({ queryKey: ['manual-journal', id] })
          void queryClient.invalidateQueries({ queryKey: ['posted-journal', id] })
          void queryClient.invalidateQueries({ queryKey: journalsKey(current!.id) })
        }}
      />
    </div>
  )
}
