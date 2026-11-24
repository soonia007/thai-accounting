import { useTranslation } from 'react-i18next'

export function ComingSoonPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-xl font-semibold">{t(titleKey)}</h1>
      <p className="mt-2 text-muted-foreground">{t('comingSoon')}</p>
    </div>
  )
}
