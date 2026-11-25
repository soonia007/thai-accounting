import { Plus, Search } from 'lucide-react'
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
import { useDocumentList, usePaymentList } from './queries'

const PAYMENTS_TAB = 'payments'

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  return (
    <Badge
      variant={status === 'posted' ? 'secondary' : 'outline'}
      className={cn('font-normal', status === 'voided' && 'text-muted-foreground line-through')}
    >
      {t(`docStatus.${status}`)}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation()
  if (!status || status === 'none') return null
  const tone: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    partial: 'bg-amber-100 text-amber-800',
    unpaid: 'bg-slate-100 text-slate-700',
    overdue: 'bg-red-100 text-red-800',
  }
  return <Badge className={cn('font-normal', tone[status])}>{t(`payStatus.${status}`)}</Badge>
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
    <div className="flex max-w-6xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t(`nav.${direction}`)}</h1>
        {canCreate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="size-4" />
                {t('docs.create')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CREATABLE[direction].map((type) => (
                <DropdownMenuItem key={type} onSelect={() => navigate(`${base}/new/${type}`)}>
                  {t(`docTypes.${type}`)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={() => navigate(`${base}/payments/new`)}>
                {t(`docs.newPayment.${direction}`)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <nav
        className="-mx-1 flex gap-1 overflow-x-auto border-b px-1"
        aria-label={t(`nav.${direction}`)}
      >
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setParams({ tab: k })}
            className={cn(
              '-mb-px shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground',
              tab === k && 'border-primary font-medium text-foreground',
            )}
          >
            {k === PAYMENTS_TAB ? t(`docs.paymentsTab.${direction}`) : t(`docTypes.${k}`)}
          </button>
        ))}
      </nav>

      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
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
                    className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent"
                  >
                    <span className="w-32 shrink-0 font-mono text-xs">
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
                    <span className="w-28 shrink-0 text-right tabular-nums">
                      <span className="block">{formatMoney(d.total, i18n.language)}</span>
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
                    className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent"
                  >
                    <span className="w-32 shrink-0 font-mono text-xs">
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
