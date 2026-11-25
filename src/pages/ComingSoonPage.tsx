import { useTranslation } from 'react-i18next'

export function ComingSoonPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{t(titleKey)}</h1>
      <p className="mt-2 text-muted-foreground">{t('comingSoon')}</p>
    </div>
  )
}
