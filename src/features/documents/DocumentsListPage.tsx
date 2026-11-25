import { FileBadge, Plus, Receipt, Search, ShoppingCart } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useCompany } from '@/features/company/CompanyProvider'
import { formatDate, formatMoney, type DateEra } from '@/lib/format'
import { canEditMasterData } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  CREATABLE,
  PURCHASE_TYPES,
  SALES_TYPES,
  basePath,
  type DocType,
  type Direction,
} from './doc-types'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { useDocumentList, usePaymentList } from './queries'

const PAYMENTS_TAB = 'payments'

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  return (
    <Badge
      variant={status === 'posted' ? 'default' : status === 'voided' ? 'danger' : 'neutral'}
      className={cn(status === 'voided' && 'line-through')}
    >
      {t(`docStatus.${status}`)}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation()
  if (!status || status === 'none') return null
  const tone = {
    paid: { variant: 'success', dot: 'bg-success' },
    partial: { variant: 'warning', dot: 'bg-warning' },
    unpaid: { variant: 'neutral', dot: 'bg-muted-foreground' },
    overdue: { variant: 'danger', dot: 'bg-destructive' },
  } as const
  const k = (status in tone ? status : 'unpaid') as keyof typeof tone
  return (
    <Badge variant={tone[k].variant} className="gap-1.5">
      <span className={cn('size-1.5 rounded-full', tone[k].dot)} />
      {t(`payStatus.${status}`)}
    </Badge>
  )
}

export function DocumentsListPage({ direction }: { direction: Direction }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { current } = useCompany()
  const companyId = current!.id
  const era: DateEra = current?.date_era ?? 'BE'
  const canCreate = canEditMasterData(current?.role)
  const types = direction === 'sales' ? SALES_TYPES : PURCHASE_TYPES
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? types[1]
  const [query, setQuery] = useState('')

  const docs = useDocumentList(companyId, tab === PAYMENTS_TAB ? [] : [tab as DocType])
  const payments = usePaymentList(companyId, direction === 'sales' ? 'received' : 'paid')

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (docs.data ?? []).filter(
      (d) => !q || [d.number ?? '', d.contact_name ?? ''].some((v) => v.toLowerCase().includes(q)),
    )
  }, [docs.data, query])
  const filteredPayments = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (payments.data ?? []).filter(
      (p) =>
        !q ||
        [p.number ?? '', p.contact_name ?? '', p.documents ?? ''].some((v) =>
          v.toLowerCase().includes(q),
        ),
    )
  }, [payments.data, query])

  const base = basePath(direction)
  const tabs = [...types, PAYMENTS_TAB]

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={direction === 'sales' ? Receipt : ShoppingCart}
        section={t(`sections.${direction}`)}
        title={t(`nav.${direction}`)}
        description={t(`pageInfo.${direction}`)}
        actions={
          <>
            {direction === 'purchases' && (
              <ActionGroup label={t('actionGroups.tax')}>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/purchases/wht-certificates">
                    <FileBadge className="size-4" />
                    {t('wht.certificatesShort')}
                  </Link>
                </Button>
              </ActionGroup>
            )}
            {canCreate && (
              <ActionGroup label={t('actionGroups.create')}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm">
                      <Plus className="size-4" />
                      {t('docs.create')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {t('actionGroups.documents')}
                    </DropdownMenuLabel>
                    {CREATABLE[direction].map((type) => (
                      <DropdownMenuItem
                        key={type}
                        onSelect={() => navigate(`${base}/new/${type}`)}
                        className="flex-col items-start gap-0"
                      >
                        <span className="font-medium">{t(`docTypes.${type}`)}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`docTypeInfo.${type}`)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {t('actionGroups.money')}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onSelect={() => navigate(`${base}/payments/new`)}
                      className="flex-col items-start gap-0"
                    >
                      <span className="font-medium">{t(`docs.newPayment.${direction}`)}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`docTypeInfo.payment_${direction}`)}
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ActionGroup>
            )}
          </>
        }
      />

      <nav
        className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1"
        aria-label={t(`nav.${direction}`)}
      >
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setParams({ tab: k })}
            className={cn(
              'h-9 shrink-0 cursor-pointer rounded-full px-4 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
              tab === k && 'bg-card text-foreground shadow-card',
            )}
          >
            {k === PAYMENTS_TAB ? t(`docs.paymentsTab.${direction}`) : t(`docTypes.${k}`)}
          </button>
        ))}
      </nav>

      <div className="relative">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="rounded-full pl-10"
          placeholder={t('docs.search')}
          aria-label={t('docs.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {tab !== PAYMENTS_TAB ? (
          <>
            {docs.isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
            {!docs.isLoading && filteredDocs.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">{t('docs.empty')}</p>
            )}
            <ul className="divide-y">
              {filteredDocs.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`${base}/${d.id}`}
                    className="flex items-center gap-4 px-4 py-3.5 text-sm transition-colors hover:bg-secondary/70 md:px-5"
                  >
                    <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">
                      {d.number ?? t('docStatus.draft')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{d.contact_name ?? '—'}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(d.doc_date, era)}
                        {d.due_date ? ` · ${t('docs.due')} ${formatDate(d.due_date, era)}` : ''}
                      </span>
                    </span>
                    <span className="hidden gap-1 sm:flex">
                      <StatusBadge status={d.status} />
                      <PaymentStatusBadge status={d.payment_status} />
                    </span>
                    <span className="w-32 shrink-0 text-right tabular-nums">
                      <span className="block font-semibold">
                        {formatMoney(d.total, i18n.language)}
                      </span>
                      {d.payment_status !== 'none' && d.status === 'posted' && (
                        <span className="block text-xs text-muted-foreground">
                          {t('docs.outstanding')} {formatMoney(d.outstanding, i18n.language)}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            {payments.isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
            {!payments.isLoading && filteredPayments.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">{t('docs.empty')}</p>
            )}
            <ul className="divide-y">
              {filteredPayments.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`${base}/payments/${p.id}`}
                    className="flex items-center gap-4 px-4 py-3.5 text-sm transition-colors hover:bg-secondary/70 md:px-5"
                  >
                    <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">
                      {p.number ?? t('docStatus.draft')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.contact_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatDate(p.pay_date, era)} · {p.documents}
                      </span>
                    </span>
                    <StatusBadge status={p.status} />
                    <span className="w-28 shrink-0 text-right tabular-nums">
                      {formatMoney(p.amount, i18n.language)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  )
}
