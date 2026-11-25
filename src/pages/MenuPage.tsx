import { ChevronRight, LayoutGrid } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { NAV_ITEMS } from '@/components/layout/nav-items'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/card'

/** Mobile "more" page listing every section (the bottom nav only fits a few). */
export function MenuPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={LayoutGrid} title={t('nav.menu')} description={t('pageInfo.menu')} />
      <Card className="gap-0 divide-y py-0">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center gap-3 p-4 hover:bg-accent">
            <Icon className="size-5" />
            <span className="flex-1">{t(labelKey)}</span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        ))}
      </Card>
    </div>
  )
}
