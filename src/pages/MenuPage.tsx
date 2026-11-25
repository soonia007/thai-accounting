import { LayoutGrid } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavTree } from '@/components/layout/NavTree'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/card'

/** Mobile "more" page: every category and function (the bottom bar only fits a few). */
export function MenuPage() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={LayoutGrid} title={t('nav.menu')} description={t('pageInfo.menu')} />
      <Card className="p-2">
        <NavTree />
      </Card>
    </div>
  )
}
