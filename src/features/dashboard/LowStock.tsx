import { PackageX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useStockBalance } from '@/features/inventory/queries'
import { todayBangkok } from '@/lib/format'

/** M13: products at or below their reorder level, with a link to the stock page. */
export function LowStock({ companyId }: { companyId: string }) {
  const { t } = useTranslation()
  const q = useStockBalance(companyId, todayBangkok())
  const low = (q.data ?? []).filter((r) => r.low)
  if (low.length === 0) return null
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
      <PackageX className="size-5 text-warning-foreground" />
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium">{t('stock.lowAlert', { count: low.length })}</div>
        <div className="truncate text-muted-foreground">
          {low
            .slice(0, 6)
            .map((r) => `${r.name} (${Number(r.qty)})`)
            .join(' · ')}
        </div>
      </div>
      <Link to="/accounting/inventory" className="text-sm font-medium text-brand-strong underline">
        {t('stock.viewStock')}
      </Link>
    </section>
  )
}
