import { Building2, ChevronRight, Settings, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/card'

export function SettingsPage() {
  const { t } = useTranslation()
  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader icon={Settings} title={t('nav.settings')} description={t('pageInfo.settings')} />
      <Card className="gap-0 divide-y py-0">
        <Link to="/settings/company" className="flex items-center gap-3 p-4 hover:bg-accent">
          <Building2 className="size-5" />
          <span className="flex-1">{t('companySettings.title')}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <Link to="/settings/members" className="flex items-center gap-3 p-4 hover:bg-accent">
          <Users className="size-5" />
          <span className="flex-1">{t('members.title')}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </Card>
    </div>
  )
}
