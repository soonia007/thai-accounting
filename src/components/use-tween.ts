import { useEffect, useRef, useState } from 'react'

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** Animate from the previous value to `value` (ease-out), e.g. 0 → 73,830.00 on first show. */
export function useTween(value: number, duration = 500, from?: number) {
  const [shown, setShown] = useState(from ?? value)
  const prev = useRef(from ?? value)
  useEffect(() => {
    const start = prev.current
    prev.current = value
    if (start === value || reduced() || typeof requestAnimationFrame === 'undefined') {
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - k, 3)
      setShown(start + (value - start) * eased)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return shown
}
