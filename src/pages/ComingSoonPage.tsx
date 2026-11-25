import { Hourglass } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/PageHeader'

export function ComingSoonPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader icon={Hourglass} title={t(titleKey)} description={t('comingSoon')} />
    </div>
  )
}
