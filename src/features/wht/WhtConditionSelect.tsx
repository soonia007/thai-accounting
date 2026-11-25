import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import type { WhtCondition } from '@/features/documents/payment-math'

const WHT_CONDITIONS: WhtCondition[] = ['withhold', 'pay_always', 'pay_once']

/** Who bears the withholding tax (docs/DECISIONS.md D8). */
export function WhtConditionSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: WhtCondition
  onChange: (v: WhtCondition) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t('wht.condition')}</Label>
      <select
        id={id}
        className="h-9 rounded-md border bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as WhtCondition)}
      >
        {WHT_CONDITIONS.map((c) => (
          <option key={c} value={c}>
            {t(`wht.conditions.${c}`)}
          </option>
        ))}
      </select>
      {value !== 'withhold' && (
        <p className="text-xs text-muted-foreground">{t(`wht.conditionHelp.${value}`)}</p>
      )}
    </div>
  )
}
