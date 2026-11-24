import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { SUPPORTED_LANGUAGES } from '@/i18n'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = i18n.resolvedLanguage ?? 'th'
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('language')}>
      {SUPPORTED_LANGUAGES.map((lng) => (
        <Button
          key={lng}
          size="sm"
          variant={current === lng ? 'default' : 'ghost'}
          aria-pressed={current === lng}
          onClick={() => void i18n.changeLanguage(lng)}
        >
          {lng.toUpperCase()}
        </Button>
      ))}
    </div>
  )
}
