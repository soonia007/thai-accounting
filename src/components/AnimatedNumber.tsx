import { useEffect, useRef, useState } from 'react'
import { useTween } from './use-tween'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Money that counts to its new value and flashes when it changes (micro-interaction).
 * The final value is always exact: the tween only affects frames in between.
 */
export function AnimatedMoney({
  value,
  lang,
  className,
  countFromZero,
  format = (n) => formatMoney(n, lang),
}: {
  value: number
  lang?: string
  className?: string
  /** first render counts up from 0 (dashboards) instead of showing the value directly */
  countFromZero?: boolean
  format?: (n: number) => string
}) {
  const shown = useTween(value, 550, countFromZero ? 0 : undefined)
  const [flash, setFlash] = useState(0)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setFlash((f) => f + 1)
  }, [value])
  return (
    <span
      key={flash}
      className={cn('tabular-nums', flash > 0 && 'animate-value-flash', className)}
      aria-label={format(value)}
    >
      {format(Math.abs(shown - value) < 0.005 ? value : Math.round(shown * 100) / 100)}
    </span>
  )
}
