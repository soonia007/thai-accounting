import { useTranslation } from 'react-i18next'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompany } from '@/features/company/CompanyProvider'
import { MyInvitations } from '@/features/company/MyInvitations'

export function HelloPage() {
  const { t } = useTranslation()
  const { current } = useCompany()
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <MyInvitations />
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t('hello.title')}</CardTitle>
          <CardDescription>
            {t('hello.workingIn', { company: current?.name })} ·{' '}
            {current && t(`roles.${current.role}`)}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
