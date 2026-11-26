import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useCompany } from '@/features/company/CompanyProvider'
import { formatDate } from '@/lib/format'

/** Shown under a date field when that date falls in a closed period (posting would be refused). */
export function LockedHint({ date }: { date: string | null | undefined }) {
  const { t } = useTranslation()
  const { current } = useCompany()
  const locked = current?.locked_through
  if (!date || !locked || date > locked) return null
  return (
    <p className="flex items-start gap-1.5 text-xs text-destructive">
      <Lock className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {t('close.lockedHint', { date: formatDate(locked, current!.date_era) })}{' '}
        <Link to="/accounting/period-close" className="underline">
          {t('close.lockedHintLink')}
        </Link>
      </span>
    </p>
  )
}
