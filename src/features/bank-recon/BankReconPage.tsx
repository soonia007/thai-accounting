import {
  ArrowLeftRight,
  CheckCircle2,
  FileDown,
  Landmark,
  Link2,
  Link2Off,
  ReceiptText,
  Sheet,
  Sparkles,
  Upload,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AccountingTabs } from '@/features/accounts/AccountingTabs'
import { dbErrorMessage } from '@/features/accounts/errors'
import { bankName } from '@/features/bank-accounts/banks'
import { useCompany } from '@/features/company/CompanyProvider'
import { exportReportPdf } from '@/features/reports/export-pdf'
import { exportXlsx } from '@/features/reports/export-xlsx'
import { ReportTableView } from '@/features/reports/ReportTableView'
import { formatDate, formatMoney, todayBangkok } from '@/lib/format'
import { canEditFinanceSetup } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { AdjustmentDialog } from './AdjustmentDialog'
import { ImportDialog } from './ImportDialog'
import { buildReconciliation } from './model'
import {
  useBankAccounts,
  useMatch,
  useReconcileData,
  useReconciliation,
  useSuggestions,
  useUnmatch,
  type StatementLine,
  type Suggestion,
} from './queries'

const r2 = (n: number) => Math.round(n * 100) / 100

/** M12: import statements, match them to the books, post what is missing, reconcile. */
export function BankReconPage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const era = co.date_era
  const canEdit = canEditFinanceSetup(co.role)
  const money = (v: number) => formatMoney(v, i18n.language)
  const [params, setParams] = useSearchParams()
  const banks = useBankAccounts(co.id)
  const bank = banks.data?.find((b) => b.id === params.get('bank')) ?? banks.data?.[0]
  const tab = params.get('tab') === 'report' ? 'report' : 'match'
  const set = (k: string, v: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set(k, v)
        return n
      },
      { replace: true },
    )

  const data = useReconcileData(bank?.id)
  const suggest = useSuggestions(bank?.id ?? '')
  const match = useMatch(bank?.id ?? '')
  const unmatch = useUnmatch(bank?.id ?? '')
  const [importOpen, setImportOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [adjustLine, setAdjustLine] = useState<StatementLine | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [hideMatched, setHideMatched] = useState(true)
  const [pairs, setPairs] = useState<(Suggestion & { on: boolean })[] | null>(null)

  const stmt = data.data?.statement ?? []
  const book = data.data?.book ?? []
  const sel = stmt.find((s) => s.id === selected) ?? null
  const pickedSum = r2(
    book.filter((b) => picked.includes(b.id)).reduce((s, b) => s + Number(b.amount), 0),
  )
  const unmatchedCount = stmt.filter((s) => !s.matched).length
  const lastBalance = [...stmt].reverse().find((s) => s.balance !== null)?.balance ?? null
  const bookBalanceToday = useReconciliation(bank?.id, todayBangkok(), null)

  const runSuggest = () =>
    suggest.mutate(undefined, {
      onSuccess: (s) => {
        setPairs(s.map((p) => ({ ...p, on: true })))
        if (s.length === 0) setNotice(t('bankRecon.noSuggestions'))
      },
    })
  const confirmPairs = () =>
    pairs &&
    match.mutate(
      pairs
        .filter((p) => p.on)
        .map((p) => ({
          statementLineId: p.statement_line_id,
          journalLineIds: [p.journal_line_id],
        })),
      {
        onSuccess: () => {
          setNotice(t('bankRecon.matchedCount', { count: pairs.filter((p) => p.on).length }))
          setPairs(null)
        },
      },
    )
  const choose = (s: StatementLine) => {
    setSelected(s.id === selected ? null : s.id)
    // preselect the book line with exactly the same amount, if there is a single one
    const same = book.filter((b) => Number(b.amount) === Number(s.amount))
    setPicked(s.id !== selected && same.length === 1 ? [same[0].id] : [])
  }
  const paymentLink = (s: StatementLine) => {
    const q = new URLSearchParams({
      date: s.txn_date,
      account: bank?.account_id ?? '',
      amount: String(Math.abs(Number(s.amount))),
      ...(s.reference ? { ref: s.reference } : {}),
    })
    return `${s.amount > 0 ? '/sales' : '/purchases'}/payments/new?${q}`
  }

  if (banks.isLoading) return <p className="p-4 text-sm text-muted-foreground">…</p>

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={ArrowLeftRight}
        section={t('nav.accounting')}
        title={t('bankRecon.title')}
        description={t('bankRecon.info')}
        actions={
          bank &&
          canEdit && (
            <>
              <ActionGroup label={t('actionGroups.importExport')}>
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                  <Upload className="size-4" />
                  {t('bankRecon.importStatement')}
                </Button>
              </ActionGroup>
              <ActionGroup label={t('bankRecon.matchGroup')}>
                <Button
                  size="sm"
                  disabled={suggest.isPending || unmatchedCount === 0}
                  onClick={runSuggest}
                >
                  <Sparkles className="size-4" />
                  {t('bankRecon.autoMatch')}
                </Button>
              </ActionGroup>
            </>
          )
        }
      />
      <AccountingTabs />

      {!bank ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-brand">
            <Landmark className="size-6" />
          </span>
          <p className="font-medium">{t('bankRecon.noBank')}</p>
          <p className="max-w-md text-sm text-muted-foreground">{t('bankRecon.noBankHint')}</p>
          <Button asChild>
            <Link to="/accounting/bank-accounts">{t('bankRecon.addBank')}</Link>
          </Button>
        </section>
      ) : (
        <>
          {/* bank picker + how it works */}
          <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-card">
            {(banks.data?.length ?? 0) > 1 && (
              <div role="tablist" className="flex flex-wrap gap-1.5">
                {banks.data!.map((b) => (
                  <button
                    key={b.id}
                    role="tab"
                    type="button"
                    aria-selected={b.id === bank.id}
                    onClick={() => {
                      set('bank', b.id)
                      setSelected(null)
                      setPairs(null)
                    }}
                    className={cn(
                      'flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm transition-colors',
                      b.id === bank.id
                        ? 'border-brand bg-accent text-brand-strong'
                        : 'hover:bg-muted',
                    )}
                  >
                    <Landmark className="size-4" />
                    {bankName(b.bank_code, i18n.language)} · {b.account_number}
                  </button>
                ))}
              </div>
            )}
            <ol className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4">
              {(['s1', 's2', 's3', 's4'] as const).map((k, i) => (
                <li key={k} className="flex items-start gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-brand-strong">
                    {i + 1}
                  </span>
                  {t(`bankRecon.steps.${k}`)}
                </li>
              ))}
            </ol>
          </section>

          {/* summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                icon: Wallet,
                label: t('bankRecon.tiles.book'),
                value: bookBalanceToday.data
                  ? money(Number(bookBalanceToday.data.book_balance))
                  : '…',
              },
              {
                icon: Landmark,
                label: t('bankRecon.tiles.statement'),
                value: lastBalance === null ? '—' : money(Number(lastBalance)),
              },
              {
                icon: ReceiptText,
                label: t('bankRecon.tiles.unmatched'),
                value: String(unmatchedCount),
              },
              { icon: Link2, label: t('bankRecon.tiles.bookOpen'), value: String(book.length) },
            ].map((x) => (
              <div
                key={x.label}
                className="flex flex-col gap-1 rounded-2xl border border-border/70 bg-card p-4 shadow-card"
              >
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <x.icon className="size-3.5 text-brand" />
                  {x.label}
                </span>
                <span className="text-xl font-semibold tabular-nums">{x.value}</span>
              </div>
            ))}
          </div>

          <div role="tablist" className="flex w-fit gap-1 rounded-full bg-muted p-1">
            {(['match', 'report'] as const).map((k) => (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={tab === k}
                onClick={() => set('tab', k)}
                className={cn(
                  'h-8 cursor-pointer rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
                  tab === k && 'bg-card text-foreground shadow-card',
                )}
              >
                {t(`bankRecon.tabs.${k}`)}
              </button>
            ))}
          </div>

          {notice && (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          {[data.error, suggest.error, match.error, unmatch.error].some((e) => e != null) && (
            <Alert variant="destructive">
              <AlertDescription>
                {dbErrorMessage(t, data.error ?? suggest.error ?? match.error ?? unmatch.error)}
              </AlertDescription>
            </Alert>
          )}

          {tab === 'match' ? (
            <>
              {pairs && pairs.length > 0 && (
                <section className="flex flex-col gap-3 rounded-2xl border border-finora-mint/50 bg-finora-mint/[0.06] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 font-semibold">
                      <Sparkles className="size-4 text-brand" />
                      {t('bankRecon.suggestTitle', { count: pairs.length })}
                    </h2>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setPairs(null)}>
                        {t('common.cancel')}
                      </Button>
                      <Button
                        size="sm"
                        disabled={match.isPending || !pairs.some((p) => p.on)}
                        onClick={confirmPairs}
                      >
                        {t('bankRecon.confirmPairs', { count: pairs.filter((p) => p.on).length })}
                      </Button>
                    </div>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {pairs.map((p, i) => {
                      const s = stmt.find((x) => x.id === p.statement_line_id)
                      const b = book.find((x) => x.id === p.journal_line_id)
                      if (!s || !b) return null
                      return (
                        <li key={p.statement_line_id}>
                          <label className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              checked={p.on}
                              onChange={(e) =>
                                setPairs(
                                  pairs.map((x, j) =>
                                    j === i ? { ...x, on: e.target.checked } : x,
                                  ),
                                )
                              }
                            />
                            <span className="min-w-0 flex-1">
                              {formatDate(s.txn_date, era)} · {s.description}
                            </span>
                            <ArrowLeftRight className="size-4 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              {formatDate(b.entry_date, era)} ·{' '}
                              <span className="font-mono text-xs">{b.ref}</span> {b.contact}
                            </span>
                            <span className="font-semibold tabular-nums">
                              {money(Number(s.amount))}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {stmt.length === 0 ? (
                <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-10 text-center">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-brand">
                    <Upload className="size-6" />
                  </span>
                  <p className="font-medium">{t('bankRecon.noStatement')}</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    {t('bankRecon.noStatementHint')}
                  </p>
                  {canEdit && (
                    <Button onClick={() => setImportOpen(true)}>
                      {t('bankRecon.importStatement')}
                    </Button>
                  )}
                </section>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {/* statement */}
                  <section className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold">{t('bankRecon.statementSide')}</h2>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={hideMatched}
                          onChange={(e) => setHideMatched(e.target.checked)}
                        />
                        {t('bankRecon.hideMatched')}
                      </label>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {stmt
                        .filter((s) => !(hideMatched && s.matched))
                        .map((s) => (
                          <li
                            key={s.id}
                            className={cn(
                              'rounded-xl border bg-card p-3 text-sm transition-all',
                              s.id === selected && 'border-brand ring-2 ring-finora-mint/50',
                              s.matched && 'bg-muted/40',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                disabled={s.matched || !canEdit}
                                onClick={() => choose(s)}
                                className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-default"
                              >
                                <span className="block text-xs text-muted-foreground">
                                  {formatDate(s.txn_date, era)}
                                  {s.reference ? ` · ${s.reference}` : ''}
                                </span>
                                <span className="block truncate">{s.description || '—'}</span>
                              </button>
                              <span
                                className={cn(
                                  'font-semibold tabular-nums',
                                  s.amount < 0 ? 'text-destructive' : 'text-success-foreground',
                                )}
                              >
                                {s.amount > 0 ? '+' : ''}
                                {money(Number(s.amount))}
                              </span>
                            </div>
                            {s.matched ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <CheckCircle2 className="size-3.5 text-success-foreground" />
                                {t('bankRecon.matchedWith')}{' '}
                                {s.book
                                  .map((b) => b.ref ?? formatDate(b.entry_date, era))
                                  .join(', ')}
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto h-7 px-2 text-xs"
                                    disabled={unmatch.isPending}
                                    onClick={() => unmatch.mutate(s.id)}
                                  >
                                    <Link2Off className="size-3.5" />
                                    {t('bankRecon.unmatch')}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              canEdit && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => choose(s)}
                                  >
                                    <Link2 className="size-3.5" />
                                    {t('bankRecon.pick')}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs"
                                    onClick={() => setAdjustLine(s)}
                                  >
                                    <ReceiptText className="size-3.5" />
                                    {s.amount < 0
                                      ? t('bankRecon.postFee')
                                      : t('bankRecon.postIncome')}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2.5 text-xs"
                                    asChild
                                  >
                                    <Link to={paymentLink(s)}>
                                      {s.amount > 0
                                        ? t('bankRecon.receiveFromCustomer')
                                        : t('bankRecon.payVendor')}
                                    </Link>
                                  </Button>
                                </div>
                              )
                            )}
                          </li>
                        ))}
                    </ul>
                  </section>

                  {/* books */}
                  <section className="flex min-w-0 flex-col gap-2 xl:sticky xl:top-6 xl:self-start">
                    <h2 className="font-semibold">{t('bankRecon.bookSide')}</h2>
                    {sel ? (
                      <p className="rounded-xl bg-accent px-3 py-2 text-xs text-brand-strong">
                        {t('bankRecon.pickHint', { amount: money(Number(sel.amount)) })}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t('bankRecon.selectFirst')}</p>
                    )}
                    {book.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                        {t('bankRecon.bookEmpty')}
                      </p>
                    ) : (
                      <ul className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
                        {book.map((b) => {
                          const same = sel && Number(b.amount) === Number(sel.amount)
                          return (
                            <li key={b.id}>
                              <label
                                className={cn(
                                  'flex items-start gap-3 rounded-xl border bg-card p-3 text-sm',
                                  sel ? 'cursor-pointer hover:border-brand' : 'opacity-80',
                                  same && 'border-finora-mint',
                                  picked.includes(b.id) && 'border-brand bg-accent/50',
                                )}
                              >
                                {sel && (
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={picked.includes(b.id)}
                                    onChange={(e) =>
                                      setPicked(
                                        e.target.checked
                                          ? [...picked, b.id]
                                          : picked.filter((x) => x !== b.id),
                                      )
                                    }
                                  />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block text-xs text-muted-foreground">
                                    {formatDate(b.entry_date, era)} ·{' '}
                                    <span className="font-mono">{b.ref}</span>
                                  </span>
                                  <span className="block truncate">
                                    {b.contact ?? b.description ?? '—'}
                                  </span>
                                </span>
                                <span
                                  className={cn(
                                    'font-semibold tabular-nums',
                                    b.amount < 0 ? 'text-destructive' : 'text-success-foreground',
                                  )}
                                >
                                  {b.amount > 0 ? '+' : ''}
                                  {money(Number(b.amount))}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {sel && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3 text-sm shadow-card">
                        <span>
                          {t('bankRecon.pickedSum')}{' '}
                          <span
                            className={cn(
                              'font-semibold tabular-nums',
                              pickedSum === Number(sel.amount)
                                ? 'text-success-foreground'
                                : 'text-destructive',
                            )}
                          >
                            {money(pickedSum)}
                          </span>{' '}
                          / {money(Number(sel.amount))}
                        </span>
                        <Button
                          size="sm"
                          disabled={
                            picked.length === 0 ||
                            pickedSum !== Number(sel.amount) ||
                            match.isPending
                          }
                          onClick={() =>
                            match.mutate([{ statementLineId: sel.id, journalLineIds: picked }], {
                              onSuccess: () => {
                                setSelected(null)
                                setPicked([])
                              },
                            })
                          }
                        >
                          <Link2 className="size-4" />
                          {t('bankRecon.matchNow')}
                        </Button>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          ) : (
            <ReconciliationReport
              bankId={bank.id}
              title={`${bankName(bank.bank_code, i18n.language)} · ${bank.account_number}`}
            />
          )}

          <ImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            bankId={bank.id}
            savedMapping={data.data?.mapping ?? null}
            era={era}
            onDone={setNotice}
          />
          <AdjustmentDialog
            line={adjustLine}
            onClose={() => setAdjustLine(null)}
            companyId={co.id}
            bankId={bank.id}
            bankLedgerId={bank.account_id}
            era={era}
          />
        </>
      )}
    </div>
  )
}

function ReconciliationReport({ bankId, title }: { bankId: string; title: string }) {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const [asOf, setAsOf] = useState(todayBangkok())
  const [balance, setBalance] = useState('')
  const stmtBalance = balance.trim() === '' ? null : Number(balance.replace(/,/g, '')) || 0
  const rec = useReconciliation(bankId, asOf, stmtBalance)
  const labels = useMemo(
    () =>
      Object.fromEntries(
        [
          'date',
          'ref',
          'description',
          'amount',
          'statementBalance',
          'bookOnly',
          'statementOnly',
          'adjusted',
          'bookBalance',
          'difference',
          'none',
        ].map((k) => [k, (t as (k: string) => string)(`bankRecon.report.${k}`)]),
      ) as never,
    [t],
  )
  const table = rec.data && buildReconciliation(rec.data, labels)
  const [busy, setBusy] = useState(false)
  const meta = {
    title: `${t('bankRecon.report.title')} — ${title}`,
    companies: [co.name],
    period: `${t('reports.asOf')} ${formatDate(asOf, co.date_era)}`,
    fileBase: `bank-reconciliation-${asOf}`,
    lang: i18n.language,
    era: co.date_era,
  }
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-card">
        <div className="grid gap-1">
          <label
            htmlFor="rec-asof"
            className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {t('reports.asOf')}
          </label>
          <Input
            id="rec-asof"
            type="date"
            className="h-9 w-44"
            value={asOf}
            onChange={(e) => e.target.value && setAsOf(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <label
            htmlFor="rec-bal"
            className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            {t('bankRecon.report.overrideBalance')}
          </label>
          <Input
            id="rec-bal"
            inputMode="decimal"
            className="h-9 w-48 text-right"
            placeholder={
              rec.data?.statement_balance != null ? String(rec.data.statement_balance) : '0.00'
            }
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </div>
        <div className="ml-auto flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={!table || busy}
            onClick={async () => {
              if (!table) return
              setBusy(true)
              try {
                await exportReportPdf(table, meta, co.logo_path)
              } finally {
                setBusy(false)
              }
            }}
          >
            <FileDown className="size-4" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!table || busy}
            onClick={async () => {
              if (!table) return
              setBusy(true)
              try {
                await exportXlsx(table, meta)
              } finally {
                setBusy(false)
              }
            }}
          >
            <Sheet className="size-4" />
            Excel
          </Button>
        </div>
      </div>
      {rec.error != null && (
        <Alert variant="destructive">
          <AlertDescription>{dbErrorMessage(t, rec.error)}</AlertDescription>
        </Alert>
      )}
      {rec.data && rec.data.statement_balance === null && (
        <p className="text-sm text-warning-foreground">{t('bankRecon.report.needBalance')}</p>
      )}
      {table && (
        <>
          {table.balanced !== undefined && (
            <p
              className={cn(
                'flex items-center gap-1.5 text-sm',
                table.balanced ? 'text-success-foreground' : 'text-destructive',
              )}
            >
              <CheckCircle2 className="size-4" />
              {table.balanced ? t('bankRecon.report.ok') : t('bankRecon.report.notOk')}
            </p>
          )}
          <ReportTableView table={table} era={co.date_era} />
        </>
      )}
    </section>
  )
}
