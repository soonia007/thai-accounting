import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '@/i18n'
import { cn } from '@/lib/utils'

/** Segmented control (iOS-style) for the UI language. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const current = i18n.resolvedLanguage ?? 'th'
  return (
    <div
      className={cn('inline-flex items-center rounded-full bg-muted p-0.5', className)}
      role="group"
      aria-label={t('language')}
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          aria-pressed={current === lng}
          onClick={() => void i18n.changeLanguage(lng)}
          className={cn(
            'h-7 min-w-10 cursor-pointer rounded-full px-3 text-xs font-semibold text-muted-foreground transition-all',
            current === lng && 'bg-card text-foreground shadow-card',
          )}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
