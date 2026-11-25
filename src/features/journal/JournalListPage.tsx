import { BookText, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AccountingTabs } from '@/features/accounts/AccountingTabs'
import { useCompany } from '@/features/company/CompanyProvider'
import { StatusBadge } from '@/features/documents/DocumentsListPage'
import { formatDate, formatMoney } from '@/lib/format'
import { canEditFinanceSetup } from '@/lib/permissions'
import { useJournalList } from './queries'

/** สมุดรายวันทั่วไป: manual / adjusting entries (M7). */
export function JournalListPage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const list = useJournalList(current!.id)
  const [q, setQ] = useState('')
  const canEdit = canEditFinanceSetup(current?.role)
  const rows = (list.data ?? []).filter((r) =>
    `${r.number ?? ''} ${r.memo ?? ''} ${r.reference ?? ''}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  )

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader
        icon={BookText}
        section={t('nav.accounting')}
        title={t('journal.title')}
        description={t('journal.subtitle')}
        actions={
          canEdit && (
            <ActionGroup label={t('actionGroups.create')}>
              <Button size="sm" asChild>
                <Link to="/accounting/journal/new">
                  <Plus className="size-4" />
                  {t('journal.new')}
                </Link>
              </Button>
            </ActionGroup>
          )
        }
      />
      <AccountingTabs />

      <div className="relative">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="rounded-full pl-10"
          placeholder={t('journal.search')}
          aria-label={t('journal.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {list.isLoading && <p className="p-4 text-sm text-muted-foreground">…</p>}
        {!list.isLoading && rows.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-brand">
              <BookText className="size-6" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">{t('journal.empty')}</p>
            {canEdit && (
              <Button asChild size="sm">
                <Link to="/accounting/journal/new">
                  <Plus className="size-4" />
                  {t('journal.new')}
                </Link>
              </Button>
            )}
          </div>
        )}
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/accounting/journal/${r.id}`}
                className="flex items-center gap-4 px-4 py-3.5 text-sm transition-colors hover:bg-secondary/70 md:px-5"
              >
                <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
                  {r.number ?? t('docStatus.draft')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {r.memo || t('journal.noMemo')}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(r.entry_date, current!.date_era)} ·{' '}
                    {t('journal.lineCount', { count: r.lines })}
                    {r.reference ? ` · ${r.reference}` : ''}
                  </span>
                </span>
                <StatusBadge status={r.status} />
                <span className="w-28 shrink-0 text-right font-semibold tabular-nums">
                  {formatMoney(r.total, i18n.language)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
