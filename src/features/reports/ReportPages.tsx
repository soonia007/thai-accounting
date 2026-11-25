import { BookOpenText, Coins, Landmark, Scale, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompany } from '@/features/company/CompanyProvider'
import { cn } from '@/lib/utils'
import {
  buildArAp,
  buildBalanceSheet,
  buildGeneralLedger,
  buildIncomeStatement,
  buildTrialBalance,
} from './model'
import {
  useAccountChoices,
  useBalanceSheet,
  useGeneralLedger,
  useIncomeStatement,
  useReceivablePayable,
  useTrialBalance,
} from './queries'
import { ReportPage } from './ReportPage'
import { useReportScope } from './scope'

/** Labels for one report, read from `reports.labels.*`. */
function useLabels<K extends string>(keys: readonly K[]): Record<K, string> {
  const { t } = useTranslation()
  // `keys` is a constant list at each call site; t changes with the language
  return useMemo(
    () =>
      Object.fromEntries(
        keys.map((k) => [k, (t as (key: string) => string)(`reports.labels.${k}`)]),
      ) as Record<K, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )
}

function useCompanyNames() {
  const { companies } = useCompany()
  return (id: string) => companies.find((c) => c.id === id)?.name ?? ''
}

export function TrialBalancePage() {
  const { i18n } = useTranslation()
  const scope = useReportScope()
  const q = useTrialBalance(scope)
  const L = useLabels([
    'code',
    'account',
    'openingDr',
    'openingCr',
    'periodDr',
    'periodCr',
    'closingDr',
    'closingCr',
    'total',
  ] as const)
  const table = useMemo(
    () => (q.data ? buildTrialBalance(q.data, i18n.language, L) : undefined),
    [q.data, i18n.language, L],
  )
  return (
    <ReportPage
      icon={Scale}
      name="trial-balance"
      scope={scope}
      mode="period"
      table={table}
      isLoading={q.isLoading}
      error={q.error}
    />
  )
}

export function IncomeStatementPage() {
  const { i18n } = useTranslation()
  const scope = useReportScope()
  const q = useIncomeStatement(scope)
  const L = useLabels([
    'code',
    'account',
    'amount',
    'revenue',
    'expenses',
    'totalRevenue',
    'totalExpenses',
    'netProfit',
    'netLoss',
  ] as const)
  const table = useMemo(
    () => (q.data ? buildIncomeStatement(q.data, i18n.language, L) : undefined),
    [q.data, i18n.language, L],
  )
  return (
    <ReportPage
      icon={TrendingUp}
      name="income-statement"
      scope={scope}
      mode="period"
      table={table}
      isLoading={q.isLoading}
      error={q.error}
    />
  )
}

export function BalanceSheetPage() {
  const { i18n } = useTranslation()
  const scope = useReportScope()
  const q = useBalanceSheet(scope)
  const L = useLabels([
    'code',
    'account',
    'amount',
    'assets',
    'liabilities',
    'equity',
    'totalAssets',
    'totalLiabilities',
    'totalEquity',
    'totalLiabilitiesEquity',
    'unclosedProfit',
  ] as const)
  const table = useMemo(
    () => (q.data ? buildBalanceSheet(q.data, i18n.language, L) : undefined),
    [q.data, i18n.language, L],
  )
  return (
    <ReportPage
      icon={Landmark}
      name="balance-sheet"
      scope={scope}
      mode="asOf"
      table={table}
      isLoading={q.isLoading}
      error={q.error}
    />
  )
}

const ALL = '__all__'

export function GeneralLedgerPage() {
  const { t, i18n } = useTranslation()
  const scope = useReportScope()
  const [params, setParams] = useSearchParams()
  const account = params.get('acc')
  const q = useGeneralLedger(scope, account)
  const choices = useAccountChoices(scope.companyIds)
  const companyName = useCompanyNames()
  const L = useLabels([
    'date',
    'ref',
    'description',
    'company',
    'debit',
    'credit',
    'balance',
    'openingBalance',
    'periodTotal',
  ] as const)
  const table = useMemo(
    () =>
      q.data
        ? buildGeneralLedger(q.data, i18n.language, L, {
            show: scope.companyIds.length > 1,
            name: companyName,
          })
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data, i18n.language, L, scope.companyIds.length],
  )
  return (
    <ReportPage
      icon={BookOpenText}
      name="general-ledger"
      scope={scope}
      mode="period"
      table={table}
      isLoading={q.isLoading}
      error={q.error}
      note={t('reports.glNote')}
      filters={
        <div className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('reports.labels.account')}
          </span>
          <Select
            value={account ?? ALL}
            onValueChange={(v) =>
              setParams(
                (p) => {
                  const n = new URLSearchParams(p)
                  if (v === ALL) n.delete('acc')
                  else n.set('acc', v)
                  return n
                },
                { replace: true },
              )
            }
          >
            <SelectTrigger className="h-9 w-72" aria-label={t('reports.labels.account')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('reports.allAccounts')}</SelectItem>
              {(choices.data ?? []).map((a) => (
                <SelectItem key={a.code} value={a.code}>
                  {a.code} {i18n.language === 'en' ? a.name_en : a.name_th}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    />
  )
}

export function ReceivablePayablePage() {
  const { t } = useTranslation()
  const scope = useReportScope()
  const [params, setParams] = useSearchParams()
  const kind = params.get('kind') === 'ap' ? 'ap' : 'ar'
  const q = useReceivablePayable(scope, kind)
  const companyName = useCompanyNames()
  const L = useLabels(['contact', 'taxId', 'company', 'total', 'unassigned'] as const)
  const balance = t(`reports.labels.${kind === 'ar' ? 'receivable' : 'payable'}`)
  const table = useMemo(
    () =>
      q.data
        ? buildArAp(
            q.data,
            { ...L, balance },
            { show: scope.companyIds.length > 1, name: companyName },
          )
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data, L, balance, scope.companyIds.length],
  )
  return (
    <ReportPage
      icon={Coins}
      name={kind === 'ar' ? 'receivables' : 'payables'}
      scope={scope}
      mode="asOf"
      table={table}
      isLoading={q.isLoading}
      error={q.error}
      note={t('reports.arApNote')}
      filters={
        <div className="flex flex-col gap-1">
          <span className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('reports.labels.kind')}
          </span>
          <div role="group" className="flex rounded-full bg-muted p-1">
            {(['ar', 'ap'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() =>
                  setParams(
                    (p) => {
                      const n = new URLSearchParams(p)
                      n.set('kind', k)
                      return n
                    },
                    { replace: true },
                  )
                }
                className={cn(
                  'h-7 cursor-pointer rounded-full px-4 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
                  kind === k && 'bg-card text-foreground shadow-card',
                )}
              >
                {t(`reports.labels.${k === 'ar' ? 'receivable' : 'payable'}`)}
              </button>
            ))}
          </div>
        </div>
      }
    />
  )
}
