import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dbErrorMessage } from '@/features/accounts/errors'
import { useCompany } from '@/features/company/CompanyProvider'
import { DocumentShareActions } from '@/features/pdf/DocumentShareActions'
import {
  PostedJournal,
  PostingPreview,
  PostingPreviewSheet,
} from '@/features/posting/PostingPreview'
import { usePostedJournal, usePostingSimulation } from '@/features/posting/simulation'
import { formatDate, formatMoney, todayBangkok } from '@/lib/format'
import { canEditFinanceSetup, canEditMasterData } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import { basePath, type Direction } from './doc-types'
import { StatusBadge } from './DocumentsListPage'
import { AttachmentsPanel } from '@/features/attachments/AttachmentsPanel'
import { WhtCertificateActions } from '@/features/wht/WhtCertificateActions'
import { WhtConditionSelect } from '@/features/wht/WhtConditionSelect'
import {
  defaultWht,
  paidAmount,
  settlementWht,
  totalWht,
  type OpenDoc,
  type WhtCondition,
  type WhtLine,
} from './payment-math'
import { documentsKey, useContacts, useMoneyAccounts } from './queries'
import { VoidDialog } from './VoidDialog'

interface AllocRow {
  selected: boolean
  amount: string
  wht: string
}

const num = (v: string) => {
  const n = Number(v.replace(/,/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

export function PaymentPage({ direction }: { direction: Direction }) {
  const { id } = useParams()
  const payment = useQuery({
    queryKey: ['payment', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('payments').select('*').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
  if (id && payment.isLoading) return <p className="text-sm text-muted-foreground">…</p>
  if (id && payment.data && payment.data.status !== 'draft') {
    return <PostedPayment direction={direction} payment={payment.data} />
  }
  // Drafts are created and posted in one go from this form; an existing draft is re-opened as new.
  return <PaymentEditor direction={direction} />
}

function PaymentEditor({ direction }: { direction: Direction }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params] = useSearchParams()
  const { current } = useCompany()
  const companyId = current!.id
  const era = current!.date_era
  const dir = direction === 'sales' ? 'received' : 'paid'
  const canPost = canEditMasterData(current?.role)

  const { data: contacts = [] } = useContacts(companyId)
  const { data: moneyAccounts = [] } = useMoneyAccounts(companyId)
  const [contactId, setContactId] = useState(params.get('contact') ?? '')
  const [payDate, setPayDate] = useState(todayBangkok())
  const [accountId, setAccountId] = useState('')
  const [reference, setReference] = useState('')
  const [edits, setEdits] = useState<Record<string, Partial<AllocRow>>>({})
  const [whtCondition, setWhtCondition] = useState<WhtCondition>('withhold')
  const preselect = params.get('doc')

  const openDocs = useQuery({
    queryKey: ['open-docs', companyId, contactId, dir],
    enabled: !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('open_documents', {
        p_company_id: companyId,
        p_contact_id: contactId,
        p_direction: dir,
      })
      if (error) throw error
      return data.map((d) => ({
        ...d,
        total: Number(d.total),
        wht_total: Number(d.wht_total),
        outstanding: Number(d.outstanding),
      }))
    },
  })

  // Purchases: WHT per income type, so the suggestion matches the 50 ทวิ certificate (D6–D8)
  const openIds = (openDocs.data ?? []).map((d) => d.id)
  const whtLines = useQuery({
    queryKey: ['open-doc-wht-lines', openIds],
    enabled: dir === 'paid' && openIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_lines')
        .select('document_id, base_amount, wht_rate, wht_income_type')
        .in('document_id', openIds)
        .gt('wht_rate', 0)
      if (error) throw error
      const byDoc: Record<string, WhtLine[]> = {}
      for (const l of data) {
        ;(byDoc[l.document_id] ??= []).push({
          base_amount: Number(l.base_amount),
          wht_rate: Number(l.wht_rate),
          wht_income_type: l.wht_income_type,
        })
      }
      return byDoc
    },
  })
  const suggestWht = (d: OpenDoc, settle: number) =>
    dir === 'paid'
      ? settlementWht(whtLines.data?.[d.id] ?? [], d.total, settle, whtCondition)
      : defaultWht(d, settle)
  const hasWht = (openDocs.data ?? []).some((d) => d.wht_total > 0)

  // Rows = defaults from the open documents (pre-select ?doc=) + the user's edits.
  // Tax follows the settled amount until the user types a tax of their own.
  const rows: Record<string, AllocRow> = Object.fromEntries(
    (openDocs.data ?? []).map((d) => {
      const e = edits[d.id] ?? {}
      const amount = e.amount ?? d.outstanding.toFixed(2)
      return [
        d.id,
        {
          selected: e.selected ?? d.id === preselect,
          amount,
          wht: e.wht ?? suggestWht(d as OpenDoc, num(amount)).toFixed(2),
        },
      ]
    }),
  )

  const effectiveAccount = accountId || moneyAccounts[0]?.id || ''
  const allocations = (openDocs.data ?? [])
    .filter((d) => rows[d.id]?.selected)
    .map((d) => ({
      document_id: d.id,
      amount: num(rows[d.id].amount),
      wht_amount: num(rows[d.id].wht),
    }))
  const amount = paidAmount(allocations, dir === 'paid' ? whtCondition : 'withhold')
  const wht = totalWht(allocations)

  // usePostingSimulation serialises + debounces, so a fresh object each render is fine
  const payload =
    allocations.length && contactId
      ? {
          company_id: companyId,
          direction: dir,
          pay_date: payDate,
          contact_id: contactId,
          payment_account_id: effectiveAccount,
          amount,
          wht_amount: wht,
          wht_condition: dir === 'paid' ? whtCondition : 'withhold',
          reference: reference || null,
          allocations,
        }
      : null
  const sim = usePostingSimulation('payment', payload)

  const post = useMutation({
    mutationFn: async () => {
      const { data: pid, error } = await supabase.rpc('save_payment', { p_pay: payload! })
      if (error) throw error
      const { error: pErr } = await supabase.rpc('post_payment', { p_payment_id: pid })
      if (pErr) {
        await supabase.from('payments').delete().eq('id', pid)
        throw pErr
      }
      return pid
    },
    onSuccess: async (pid) => {
      await queryClient.invalidateQueries({ queryKey: documentsKey(companyId) })
      await queryClient.invalidateQueries({ queryKey: ['document-balance'] })
      navigate(`${basePath(direction)}/payments/${pid}`, { replace: true })
    },
  })

  const setRow = (docId: string, patch: Partial<AllocRow>) =>
    setEdits((e) => ({ ...e, [docId]: { ...e[docId], ...patch } }))

  const contactOptions = contacts.filter(
    (c) =>
      c.contact_type === 'both' ||
      c.contact_type === (direction === 'sales' ? 'customer' : 'vendor'),
  )

  return (
    <div className="flex flex-col gap-4 pb-28 md:pb-0">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label={t('common.back')}>
          <Link to={`${basePath(direction)}?tab=payments`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{t(`docs.newPayment.${direction}`)}</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-4">
          {post.error && (
            <Alert variant="destructive">
              <AlertDescription>{dbErrorMessage(t, post.error)}</AlertDescription>
            </Alert>
          )}
          <Card className="py-4">
            <CardContent className="grid gap-4 px-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="p-contact">
                  {direction === 'sales' ? t('docs.customer') : t('docs.vendor')}
                </Label>
                <select
                  id="p-contact"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                >
                  <option value="">{t('docs.chooseContact')}</option>
                  {contactOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-date">{t('docs.payDate')}</Label>
                <Input
                  id="p-date"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="p-account">
                  {direction === 'sales' ? t('docs.receivedInto') : t('docs.paidFrom')}
                </Label>
                <select
                  id="p-account"
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={effectiveAccount}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  {moneyAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} {i18n.language === 'en' ? a.name_en || a.name_th : a.name_th}
                      {a.detail ? ` · ${a.detail}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {dir === 'paid' && hasWht && (
                <div className="sm:col-span-2">
                  <WhtConditionSelect
                    id="p-wht-condition"
                    value={whtCondition}
                    onChange={(c) => {
                      setWhtCondition(c)
                      // re-suggest tax for rows the user has not typed a tax into
                      setEdits((e) =>
                        Object.fromEntries(
                          Object.entries(e).map(([k, v]) => [k, { ...v, wht: undefined }]),
                        ),
                      )
                    }}
                  />
                </div>
              )}
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="p-ref">{t('docs.reference')}</Label>
                <Input
                  id="p-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardContent className="flex flex-col gap-2 px-4">
              <h2 className="text-sm font-medium">{t('docs.openDocuments')}</h2>
              {!contactId && (
                <p className="text-sm text-muted-foreground">{t('docs.chooseContactFirst')}</p>
              )}
              {contactId && openDocs.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('docs.nothingOpen')}</p>
              )}
              {(openDocs.data ?? []).map((d) => {
                const r = rows[d.id]
                if (!r) return null
                return (
                  <div
                    key={d.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-md border p-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)_8rem_7rem]"
                  >
                    <input
                      type="checkbox"
                      aria-label={d.number ?? ''}
                      checked={r.selected}
                      onChange={(e) => setRow(d.id, { selected: e.target.checked })}
                    />
                    <div className="min-w-0">
                      <div className="font-mono text-xs">{d.number}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(d.doc_date, era)} · {t('docs.outstanding')}{' '}
                        {formatMoney(d.outstanding, i18n.language)}
                      </div>
                    </div>
                    <label className="col-start-2 flex items-center gap-2 text-xs text-muted-foreground sm:col-start-auto sm:block">
                      <span className="sm:sr-only">{t('docs.settle')}</span>
                      <Input
                        inputMode="decimal"
                        className="text-right"
                        disabled={!r.selected}
                        value={r.amount}
                        onChange={(e) => setRow(d.id, { amount: e.target.value, wht: undefined })}
                      />
                    </label>
                    <label className="col-start-2 flex items-center gap-2 text-xs text-muted-foreground sm:col-start-auto sm:block">
                      <span className="sm:sr-only">{t('docs.whtAmount')}</span>
                      <Input
                        inputMode="decimal"
                        className="text-right"
                        disabled={!r.selected}
                        value={r.wht}
                        onChange={(e) => setRow(d.id, { wht: e.target.value })}
                        aria-label={t('docs.whtAmount')}
                      />
                    </label>
                  </div>
                )
              })}
              <div className="mt-2 ml-auto flex w-64 flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('docs.whtAmount')}</span>
                  <span className="tabular-nums">{formatMoney(wht, i18n.language)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{direction === 'sales' ? t('docs.moneyIn') : t('docs.moneyOut')}</span>
                  <span className="tabular-nums">{formatMoney(amount, i18n.language)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {canPost && (
            <div className="flex justify-end">
              <Button
                disabled={!payload || post.isPending}
                onClick={() => {
                  if (window.confirm(t('docs.confirmPost'))) post.mutate()
                }}
              >
                {t('docs.post')}
              </Button>
            </div>
          )}
        </div>
        <PostingPreview result={sim.data} isFetching={sim.isFetching} />
      </div>
      <PostingPreviewSheet result={sim.data} isFetching={sim.isFetching} />
    </div>
  )
}

function PostedPayment({
  direction,
  payment,
}: {
  direction: Direction
  payment: {
    id: string
    number: string | null
    status: string
    pay_date: string
    contact_id: string
    amount: number
    wht_amount: number
    void_reason: string | null
    reference: string | null
  }
}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const journal = usePostedJournal({ paymentId: payment.id }, true)
  const { data: contacts = [] } = useContacts(current!.id)
  const [voidOpen, setVoidOpen] = useState(false)
  const allocs = useQuery({
    queryKey: ['payment-allocs', payment.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_allocations')
        .select('amount, wht_amount, vat_transferred, documents (id, number, type)')
        .eq('payment_id', payment.id)
      if (error) throw error
      return data
    },
  })
  const posted = payment.status === 'posted'
  const base = basePath(direction)

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label={t('common.back')}>
          <Link to={`${base}?tab=payments`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">
          {t(`docs.paymentTitle.${direction}`)} <span className="font-mono">{payment.number}</span>
        </h1>
        <StatusBadge status={payment.status} />
      </div>
      <div className="flex flex-wrap gap-2">
        <DocumentShareActions paymentId={payment.id} number={payment.number} posted={posted} />
        {direction === 'purchases' && <WhtCertificateActions paymentId={payment.id} />}
        {posted && canEditFinanceSetup(current?.role) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setVoidOpen(true)}
          >
            <Ban className="size-4" />
            {t('docs.void')}
          </Button>
        )}
      </div>
      {payment.status === 'voided' && (
        <Alert>
          <AlertDescription>
            {t('docs.voidedNote', { reason: payment.void_reason ?? '' })}
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_26rem]">
        <Card className="py-4">
          <CardContent className="flex flex-col gap-3 px-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">
                {direction === 'sales' ? t('docs.customer') : t('docs.vendor')}
              </dt>
              <dd>{contacts.find((c) => c.id === payment.contact_id)?.name}</dd>
              <dt className="text-muted-foreground">{t('docs.payDate')}</dt>
              <dd>{formatDate(payment.pay_date, current!.date_era)}</dd>
              <dt className="text-muted-foreground">
                {direction === 'sales' ? t('docs.moneyIn') : t('docs.moneyOut')}
              </dt>
              <dd className="font-medium">{formatMoney(payment.amount, i18n.language)}</dd>
              <dt className="text-muted-foreground">{t('docs.whtAmount')}</dt>
              <dd>{formatMoney(payment.wht_amount, i18n.language)}</dd>
            </dl>
            <ul className="divide-y rounded-md border">
              {(allocs.data ?? []).map((a) => (
                <li key={a.documents.id} className="flex justify-between px-3 py-2">
                  <Link
                    to={`${base}/${a.documents.id}`}
                    className="font-mono text-xs text-primary underline"
                  >
                    {a.documents.number}
                  </Link>
                  <span className="tabular-nums">{formatMoney(a.amount, i18n.language)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div>{journal.data && <PostedJournal entries={journal.data} />}</div>
      </div>
      <AttachmentsPanel paymentId={payment.id} />
      <VoidDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        target={{ paymentId: payment.id }}
        number={payment.number}
        onVoided={() => {
          void queryClient.invalidateQueries({ queryKey: ['payment', payment.id] })
          void queryClient.invalidateQueries({ queryKey: ['posted-journal', payment.id] })
          void queryClient.invalidateQueries({ queryKey: documentsKey(current!.id) })
        }}
      />
    </div>
  )
}
