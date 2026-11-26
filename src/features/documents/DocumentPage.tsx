import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, CircleDollarSign, Plus, Repeat } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { VatClaimCard } from '@/features/vat/VatClaimCard'
import { ContactDialog } from '@/features/contacts/ContactDialog'
import { usePendingLines } from '@/features/fixed-assets/queries'
import { WhtReceivedCard } from '@/features/wht/WhtReceivedCard'
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
import { addDays, formatDate, formatMoney, todayBangkok } from '@/lib/format'
import { canEditFinanceSetup, canEditMasterData } from '@/lib/permissions'
import { supabase } from '@/lib/supabase'
import {
  CONVERSIONS,
  basePath,
  directionOf,
  isCashType,
  isCreditType,
  isNonPosting,
  isNoteType,
  type DocType,
  type Direction,
} from './doc-types'
import { PaymentStatusBadge, StatusBadge } from './DocumentsListPage'
import { LinesEditor } from './LinesEditor'
import { docToForm, emptyLine, formTotals, toPayload, type DocForm } from './payload'
import {
  documentsKey,
  useContacts,
  useDocument,
  useDocumentBalance,
  useMoneyAccounts,
  useProducts,
} from './queries'
import { VoidDialog } from './VoidDialog'
import { AttachmentsPanel } from '@/features/attachments/AttachmentsPanel'
import { useWhtIncomeTypes } from '@/features/wht/queries'
import { WhtCertificateActions } from '@/features/wht/WhtCertificateActions'
import { WhtConditionSelect } from '@/features/wht/WhtConditionSelect'
import { useFocusTracking } from '@/features/posting/focus'
import { PreviewFocusProvider } from '@/features/posting/PreviewFocusProvider'
import { settlementWht } from './payment-math'

const blankForm = (): DocForm => ({
  contact_id: '',
  doc_date: todayBangkok(),
  due_date: '',
  vat_mode: 'exclusive',
  payment_account_id: '',
  ref_document_id: '',
  reference: '',
  notes: '',
  wht_condition: 'withhold',
  tax_invoice_no: '',
  tax_invoice_date: '',
  vat_claim_month: '',
  restock: true,
  lines: [emptyLine()],
})

export function DocumentPage({ direction }: { direction: Direction }) {
  const { id, type: newType } = useParams()
  const [params] = useSearchParams()
  const fromId = params.get('from') ?? undefined
  const existing = useDocument(id)
  const source = useDocument(id ? undefined : fromId)

  if (id && existing.isLoading) return <p className="text-sm text-muted-foreground">…</p>
  if (id && !existing.data) return <p className="text-sm text-muted-foreground">404</p>
  if (!id && fromId && source.isLoading) return <p className="text-sm text-muted-foreground">…</p>

  const doc = existing.data?.doc
  const type = (doc?.type ?? newType) as DocType
  if (doc && doc.status !== 'draft') {
    return <PostedDocument direction={direction} id={doc.id} />
  }

  let initial: DocForm = blankForm()
  if (existing.data) initial = docToForm(existing.data.doc, existing.data.lines)
  else if (source.data) {
    const s = source.data
    initial = {
      ...docToForm(s.doc, s.lines),
      doc_date: todayBangkok(),
      due_date: '',
      // notes reference the invoice; conversions keep a link to the quotation / PO
      ref_document_id: s.doc.id,
      payment_account_id: '',
    }
    if (isNoteType(type)) initial.lines = [emptyLine()]
  }

  return (
    <PreviewFocusProvider>
      <DocumentEditor
        key={id ?? `${type}-${fromId ?? 'new'}`}
        direction={direction}
        type={type}
        id={id}
        initial={initial}
      />
    </PreviewFocusProvider>
  )
}

function DocumentEditor({
  direction,
  type,
  id,
  initial,
}: {
  direction: Direction
  type: DocType
  id: string | undefined
  initial: DocForm
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const companyId = current!.id
  const vatRegistered = current!.vat_registered
  const vatRate = Number(current!.vat_rate)
  const co = useMemo(
    () => ({ vat_registered: vatRegistered, vat_rate: vatRate }),
    [vatRegistered, vatRate],
  )
  const canPost = canEditMasterData(current?.role)
  const isSale = direction === 'sales'

  const { data: contacts = [] } = useContacts(companyId)
  const { data: products = [] } = useProducts(companyId)
  const { data: moneyAccounts = [] } = useMoneyAccounts(companyId)

  const { register, control, setValue, getValues, handleSubmit } = useForm<DocForm>({
    defaultValues: initial,
  })
  const form = useWatch({ control }) as DocForm

  // Notes: invoices of the chosen customer that can be referenced
  const refOptions = useQuery({
    queryKey: ['note-refs', companyId, form.contact_id],
    enabled: isNoteType(type) && !!form.contact_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, number, doc_date, total')
        .eq('company_id', companyId)
        .eq('contact_id', form.contact_id)
        .eq('status', 'posted')
        .in('type', ['invoice', 'debit_note'])
        .order('doc_date', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Default due date from the customer's credit term
  const contact = contacts.find((c) => c.id === form.contact_id)
  useEffect(() => {
    if (!isCreditType(type) || !contact || getValues('due_date')) return
    setValue('due_date', addDays(getValues('doc_date'), contact.credit_term_days))
  }, [contact, type, getValues, setValue])

  // Default money account for cash documents
  useEffect(() => {
    if (isCashType(type) && !getValues('payment_account_id') && moneyAccounts[0]) {
      setValue('payment_account_id', moneyAccounts[0].id)
    }
  }, [moneyAccounts, type, getValues, setValue])

  const totals = useMemo(() => formTotals(form, co), [form, co])
  const focusTracking = useFocusTracking()
  const incomeTypes = useWhtIncomeTypes(!isSale)
  // D8: on a cash purchase the payer may bear the tax (pay_always grosses it up)
  const borne = type === 'cash_purchase' && form.wht_condition !== 'withhold'
  const borneTax = useMemo(() => {
    if (!borne || !totals) return 0
    const whtLines = form.lines.map((l, i) => ({
      base_amount: totals.lines[i]?.base ?? 0,
      wht_rate: Number(l.wht_rate) || 0,
      wht_income_type: l.wht_income_type || null,
    }))
    return settlementWht(whtLines, totals.total, totals.total, form.wht_condition)
  }, [borne, totals, form.lines, form.wht_condition])
  const payload = useMemo(
    () => toPayload(companyId, type, form, co, id),
    [form, companyId, type, co, id],
  )
  const sim = usePostingSimulation('document', payload.lines.length ? payload : null)
  const shortages = sim.data?.ok ? (sim.data.stock?.shortages ?? []) : []

  const save = useMutation({
    mutationFn: async ({ post }: { post: boolean }) => {
      const { data: savedId, error } = await supabase.rpc('save_document', {
        p_doc: toPayload(companyId, type, getValues(), co, id),
      })
      if (error) throw error
      if (post) {
        const { error: pErr } = await supabase.rpc('post_document', { p_document_id: savedId })
        if (pErr) {
          // keep the saved draft; send the user to it with the error visible
          if (!id) navigate(`${basePath(direction)}/${savedId}`, { replace: true })
          throw pErr
        }
      }
      return savedId
    },
    onSuccess: async (savedId) => {
      await queryClient.invalidateQueries({ queryKey: documentsKey(companyId) })
      await queryClient.invalidateQueries({ queryKey: ['document', savedId] })
      navigate(`${basePath(direction)}/${savedId}`, { replace: true })
    },
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('documents').delete().eq('id', id!)
      if (error) throw error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentsKey(companyId) })
      navigate(basePath(direction))
    },
  })

  const [newContact, setNewContact] = useState(false)
  // a contact created from this form is selected once it shows up in the (refetched) list
  const pendingContact = useRef<string | null>(null)
  const canAddContact = canEditMasterData(current?.role)
  const contactOptions = contacts.filter(
    (c) =>
      (c.is_active || c.id === form.contact_id) &&
      (c.contact_type === 'both' || c.contact_type === (isSale ? 'customer' : 'vendor')),
  )
  useEffect(() => {
    const id = pendingContact.current
    if (id && contactOptions.some((c) => c.id === id)) {
      setValue('contact_id', id, { shouldDirty: true })
      pendingContact.current = null
    }
  }, [contactOptions, setValue])

  return (
    <div className="flex flex-col gap-4 pb-28 md:pb-0">
      <PageHeader
        backTo={`${basePath(direction)}?tab=${type}`}
        section={t(`sections.${direction}`)}
        title={t(`docTypes.${type}`)}
        badges={<StatusBadge status="draft" />}
        description={t(`docTypeInfo.${type}`)}
      />

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem] 2xl:grid-cols-[minmax(0,1fr)_36rem]">
        <form
          className="flex min-w-0 flex-col gap-4"
          noValidate
          {...focusTracking}
          onSubmit={handleSubmit(() => save.mutate({ post: false }))}
        >
          {save.error && (
            <Alert variant="destructive">
              <AlertDescription>{dbErrorMessage(t, save.error)}</AlertDescription>
            </Alert>
          )}

          <Card className="py-4 transition-shadow duration-300 focus-within:ring-2 focus-within:ring-finora-mint/60">
            <CardContent className="grid gap-4 px-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="d-contact">
                    {isSale ? t('docs.customer') : t('docs.vendor')}
                  </Label>
                  {canAddContact && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-brand-strong"
                      onClick={() => setNewContact(true)}
                    >
                      <Plus className="size-3.5" />
                      {isSale ? t('quickAdd.customer') : t('quickAdd.vendor')}
                    </Button>
                  )}
                </div>
                <select
                  id="d-contact"
                  className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm shadow-xs"
                  {...register('contact_id')}
                >
                  <option value="">{t('docs.chooseContact')}</option>
                  {contactOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.tax_id ? ` (${c.tax_id})` : ''}
                    </option>
                  ))}
                </select>
                {contactOptions.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {isSale ? t('quickAdd.noCustomers') : t('quickAdd.noVendors')}
                  </p>
                )}
                <ContactDialog
                  companyId={current!.id}
                  contact={newContact ? null : undefined}
                  defaultType={isSale ? 'customer' : 'vendor'}
                  onClose={() => setNewContact(false)}
                  onCreated={(c) => (pendingContact.current = c.id)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="d-date">{t('docs.date')}</Label>
                <Input id="d-date" type="date" {...register('doc_date')} />
              </div>
              {isCreditType(type) || type === 'quotation' || type === 'purchase_order' ? (
                <div className="grid gap-2">
                  <Label htmlFor="d-due">
                    {type === 'quotation' ? t('docs.validUntil') : t('docs.dueDate')}
                  </Label>
                  <Input id="d-due" type="date" {...register('due_date')} />
                </div>
              ) : (
                <div />
              )}
              {isCashType(type) && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="d-money">
                    {isSale ? t('docs.receivedInto') : t('docs.paidFrom')}
                  </Label>
                  <select
                    id="d-money"
                    className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm shadow-xs"
                    {...register('payment_account_id')}
                  >
                    {moneyAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} {i18n.language === 'en' ? a.name_en || a.name_th : a.name_th}
                        {a.detail ? ` · ${a.detail}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {isNoteType(type) && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="d-ref">{t('docs.refInvoice')}</Label>
                  <select
                    id="d-ref"
                    className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm shadow-xs"
                    {...register('ref_document_id')}
                  >
                    <option value="">{t('docs.chooseInvoice')}</option>
                    {(refOptions.data ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.number} · {formatDate(d.doc_date, current!.date_era)} ·{' '}
                        {formatMoney(d.total, i18n.language)}
                      </option>
                    ))}
                  </select>
                  {type === 'credit_note' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" {...register('restock')} />
                      {t('stock.restock')}
                      <span className="text-xs text-muted-foreground">
                        {t('stock.restockHint')}
                      </span>
                    </label>
                  )}
                </div>
              )}
              {co.vat_registered && (
                <div className="grid gap-2">
                  <Label htmlFor="d-vat">{t('docs.vatMode')}</Label>
                  <select
                    id="d-vat"
                    className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm shadow-xs"
                    {...register('vat_mode')}
                  >
                    {(['exclusive', 'inclusive', 'none'] as const).map((m) => (
                      <option key={m} value={m}>
                        {t(`docs.vatModes.${m}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {type === 'cash_purchase' && (totals?.whtTotal ?? 0) > 0 && (
                <div className="sm:col-span-2">
                  <WhtConditionSelect
                    id="d-wht-condition"
                    value={form.wht_condition}
                    onChange={(c) => setValue('wht_condition', c)}
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="d-ref-text">{t('docs.reference')}</Label>
                <Input id="d-ref-text" {...register('reference')} />
              </div>
              {!isSale && vatRegistered && (
                <fieldset className="grid gap-3 rounded-xl border border-dashed p-3 sm:col-span-2 sm:grid-cols-3">
                  <legend className="px-1 text-xs font-semibold text-muted-foreground">
                    {t('vat.claim.title')}
                  </legend>
                  <div className="grid gap-2">
                    <Label htmlFor="d-ti-no">{t('vat.claim.invoiceNo')}</Label>
                    <Input
                      id="d-ti-no"
                      placeholder={form.reference || undefined}
                      {...register('tax_invoice_no')}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="d-ti-date">{t('vat.claim.invoiceDate')}</Label>
                    <Input id="d-ti-date" type="date" {...register('tax_invoice_date')} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="d-claim-month">{t('vat.claim.month')}</Label>
                    <Input id="d-claim-month" type="month" {...register('vat_claim_month')} />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-3">
                    {t('vat.claim.hint')}
                  </p>
                </fieldset>
              )}
            </CardContent>
          </Card>

          {shortages.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                {shortages
                  .map((s) => t('stock.shortage', { name: s.name, short: Number(s.short) }))
                  .join(' · ')}{' '}
                <Link to="/accounting/inventory" className="underline">
                  {t('stock.shortageAction')}
                </Link>
              </AlertDescription>
            </Alert>
          )}
          <Card className="py-4 transition-shadow duration-300 focus-within:ring-2 focus-within:ring-finora-mint/60">
            <CardContent className="px-4">
              <LinesEditor
                control={control}
                register={register}
                setValue={setValue}
                products={products}
                isSale={isSale}
                vatRegistered={co.vat_registered}
                lineAmounts={totals?.lines}
                incomeTypes={isSale ? undefined : incomeTypes.data}
                companyId={current!.id}
                canAddProduct={canEditMasterData(current?.role)}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="d-notes">{t('docs.notes')}</Label>
              <textarea
                id="d-notes"
                rows={3}
                className="rounded-xl border bg-card px-3.5 py-2.5 text-sm shadow-xs"
                {...register('notes')}
              />
            </div>
            <TotalsBox
              totals={totals}
              vatRegistered={co.vat_registered}
              isCash={isCashType(type)}
              borneTax={borne ? borneTax : null}
            />
          </div>

          {id && <AttachmentsPanel documentId={id} />}

          {canPost && (
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
              <Button type="submit" variant="outline" disabled={save.isPending}>
                {t('docs.saveDraft')}
              </Button>
              <Button
                type="button"
                disabled={save.isPending || !totals}
                onClick={() => {
                  if (
                    window.confirm(t(isNonPosting(type) ? 'docs.confirmIssue' : 'docs.confirmPost'))
                  )
                    save.mutate({ post: true })
                }}
              >
                {isNonPosting(type) ? t('docs.issue') : t('docs.post')}
              </Button>
            </div>
          )}
        </form>

        <PostingPreview
          result={sim.data}
          isFetching={sim.isFetching}
          error={sim.error}
          noPosting={isNonPosting(type)}
        />
      </div>
      <PostingPreviewSheet
        result={sim.data}
        isFetching={sim.isFetching}
        error={sim.error}
        noPosting={isNonPosting(type)}
      />
    </div>
  )
}

function TotalsBox({
  totals,
  vatRegistered,
  isCash,
  borneTax,
}: {
  totals: ReturnType<typeof formTotals>
  vatRegistered: boolean
  isCash: boolean
  /** D8: tax the payer bears on top (null = normal withholding) */
  borneTax: number | null
}) {
  const { t, i18n } = useTranslation()
  if (!totals) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('dbErrors.LINE_NEGATIVE')}</AlertDescription>
      </Alert>
    )
  }
  const row = (label: string, value: number, strong = false) => (
    <div className={`flex justify-between gap-4 ${strong ? 'font-semibold' : ''}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{formatMoney(value, i18n.language)}</span>
    </div>
  )
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border bg-card p-4 text-sm shadow-card">
      {row(t('totals.subtotal'), totals.subtotal)}
      {vatRegistered && row(t('totals.vat'), totals.vatTotal)}
      {row(t('totals.total'), totals.total, true)}
      {borneTax !== null && totals.whtTotal > 0 && row(t('wht.borneTax'), borneTax)}
      {borneTax === null && totals.whtTotal > 0 && (
        <>
          {row(isCash ? t('totals.whtNow') : t('totals.whtLater'), -totals.whtTotal)}
          {row(isCash ? t('totals.net') : t('totals.netExpected'), totals.netTotal, true)}
        </>
      )}
    </div>
  )
}

function PostedDocument({ direction, id }: { direction: Direction; id: string }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { current } = useCompany()
  const era = current!.date_era
  const { data } = useDocument(id)
  const doc = data!.doc
  const lines = data!.lines
  const type = doc.type
  const posted = doc.status === 'posted'
  const balance = useDocumentBalance(id, isCreditType(type) && posted)
  const journal = usePostedJournal({ documentId: id }, !isNonPosting(type))
  const { data: contacts = [] } = useContacts(current!.id)
  const contact = contacts.find((c) => c.id === doc.contact_id)
  const [voidOpen, setVoidOpen] = useState(false)
  const canVoid = canEditFinanceSetup(current?.role) && posted
  const canCreate = canEditMasterData(current?.role)
  const base = basePath(directionOf(type))
  const outstanding = Number(balance.data?.outstanding ?? 0)
  const payStatus =
    !posted || !isCreditType(type)
      ? null
      : outstanding <= 0
        ? 'paid'
        : doc.due_date && doc.due_date < todayBangkok()
          ? 'overdue'
          : Number(balance.data?.paid ?? 0) > 0
            ? 'partial'
            : 'unpaid'

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        backTo={`${base}?tab=${type}`}
        section={`${t(`sections.${direction}`)} · ${t(`docTypes.${type}`)}`}
        title={<span className="font-mono">{doc.number}</span>}
        badges={
          <>
            <StatusBadge status={doc.status} />
            <PaymentStatusBadge status={payStatus} />
          </>
        }
        description={contact?.name}
        actions={
          <>
            <ActionGroup label={t('actionGroups.share')}>
              <DocumentShareActions documentId={doc.id} number={doc.number} posted={posted} />
              {type === 'cash_purchase' && <WhtCertificateActions documentId={doc.id} />}
            </ActionGroup>
            {posted &&
              canCreate &&
              ((CONVERSIONS[type] ?? []).length > 0 || (isCreditType(type) && outstanding > 0)) && (
                <ActionGroup label={t('actionGroups.next')}>
                  {(CONVERSIONS[type] ?? []).map((to) => (
                    <Button
                      key={to}
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`${basePath(directionOf(to))}/new/${to}?from=${doc.id}`)
                      }
                    >
                      <Repeat className="size-4" />
                      {t('docs.convertTo', { type: t(`docTypes.${to}`) })}
                    </Button>
                  ))}
                  {isCreditType(type) && outstanding > 0 && (
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate(`${base}/payments/new?contact=${doc.contact_id}&doc=${doc.id}`)
                      }
                    >
                      <CircleDollarSign className="size-4" />
                      {direction === 'sales' ? t('docs.receivePayment') : t('docs.makePayment')}
                    </Button>
                  )}
                </ActionGroup>
              )}
            {canVoid && (
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
            )}
          </>
        }
      />

      {type === 'cash_sale' && Number(doc.wht_total) > 0 && doc.status !== 'draft' && (
        <WhtReceivedCard
          target={{ documentId: doc.id }}
          amount={Number(doc.wht_total)}
          certNo={doc.received_wht_cert_no}
          certDate={doc.received_wht_cert_date}
          era={era}
          canEdit={canCreate && doc.status !== 'voided'}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ['document', id] })}
        />
      )}
      {(type === 'bill' || type === 'cash_purchase') && <AssetPrompt documentId={doc.id} />}
      {(type === 'bill' || type === 'cash_purchase') &&
        current!.vat_registered &&
        Number(doc.vat_total) > 0 && (
          <VatClaimCard
            target={{ documentId: doc.id }}
            taxInvoiceNo={doc.tax_invoice_no}
            taxInvoiceDate={doc.tax_invoice_date}
            claimMonth={doc.vat_claim_month}
            fallbackNo={doc.reference}
            fallbackDate={doc.doc_date}
            era={era}
            canEdit={canCreate && doc.status !== 'voided'}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ['document', id] })}
          />
        )}
      {doc.status === 'voided' && (
        <Alert>
          <AlertDescription>
            {t('docs.voidedNote', { reason: doc.void_reason ?? '' })}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_22rem] lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem] 2xl:grid-cols-[minmax(0,1fr)_36rem]">
        <Card className="py-4">
          <CardContent className="flex flex-col gap-4 px-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">
                {direction === 'sales' ? t('docs.customer') : t('docs.vendor')}
              </dt>
              <dd>{contact?.name ?? '—'}</dd>
              <dt className="text-muted-foreground">{t('docs.date')}</dt>
              <dd>{formatDate(doc.doc_date, era)}</dd>
              {doc.due_date && (
                <>
                  <dt className="text-muted-foreground">{t('docs.dueDate')}</dt>
                  <dd>{formatDate(doc.due_date, era)}</dd>
                </>
              )}
              {doc.reference && (
                <>
                  <dt className="text-muted-foreground">{t('docs.reference')}</dt>
                  <dd>{doc.reference}</dd>
                </>
              )}
              {isCreditType(type) && posted && (
                <>
                  <dt className="text-muted-foreground">{t('docs.outstanding')}</dt>
                  <dd className="font-medium">{formatMoney(outstanding, i18n.language)}</dd>
                </>
              )}
            </dl>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1 font-normal">{t('lines.item')}</th>
                  <th className="py-1 text-right font-normal">{t('lines.qty')}</th>
                  <th className="py-1 text-right font-normal">{t('lines.price')}</th>
                  <th className="py-1 text-right font-normal">{t('lines.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="py-1.5">{l.description}</td>
                    <td className="py-1.5 text-right tabular-nums">{Number(l.qty)}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatMoney(l.unit_price, i18n.language)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatMoney(Number(l.base_amount) + Number(l.vat_amount), i18n.language)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto flex w-64 flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('totals.subtotal')}</span>
                <span className="tabular-nums">{formatMoney(doc.subtotal, i18n.language)}</span>
              </div>
              {current!.vat_registered && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('totals.vat')}</span>
                  <span className="tabular-nums">{formatMoney(doc.vat_total, i18n.language)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>{t('totals.total')}</span>
                <span className="tabular-nums">{formatMoney(doc.total, i18n.language)}</span>
              </div>
              {Number(doc.wht_total) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {doc.wht_condition !== 'withhold'
                      ? t('wht.borneTax')
                      : isCashType(type)
                        ? t('totals.whtNow')
                        : t('totals.whtLater')}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(
                      (doc.wht_condition !== 'withhold' ? 1 : -1) * Number(doc.wht_total),
                      i18n.language,
                    )}
                  </span>
                </div>
              )}
            </div>
            {doc.notes && <p className="whitespace-pre-wrap text-muted-foreground">{doc.notes}</p>}
          </CardContent>
        </Card>
        <div>
          {isNonPosting(type) ? (
            <p className="rounded-xl border p-4 text-sm text-muted-foreground">
              {t('preview.noPosting')}
            </p>
          ) : (
            journal.data && <PostedJournal entries={journal.data} />
          )}
        </div>
      </div>

      <AttachmentsPanel documentId={doc.id} />

      <VoidDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        target={{ documentId: doc.id }}
        number={doc.number}
        onVoided={() => {
          void queryClient.invalidateQueries({ queryKey: ['document', id] })
          void queryClient.invalidateQueries({ queryKey: ['posted-journal', id] })
          void queryClient.invalidateQueries({ queryKey: documentsKey(current!.id) })
        }}
      />
    </div>
  )
}

/** M14: a purchase posted to a fixed-asset account → offer to register the asset (one click). */
function AssetPrompt({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const { current } = useCompany()
  const pending = usePendingLines(current!.id)
  const lines = (pending.data ?? []).filter((l) => l.document_id === documentId)
  if (!lines.length || !canEditFinanceSetup(current?.role)) return null
  return (
    <Alert>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        {t('fa.purchasePrompt', { count: lines.length })}
        {lines.map((l) => (
          <Button key={l.line_id} size="sm" variant="outline" className="h-7" asChild>
            <Link to={`/accounting/fixed-assets?register=${l.line_id}`}>
              {t('fa.registerThis', { name: l.description })}
            </Link>
          </Button>
        ))}
      </AlertDescription>
    </Alert>
  )
}
