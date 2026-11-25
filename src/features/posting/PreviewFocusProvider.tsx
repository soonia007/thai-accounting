import { useCallback, useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import { FocusCtx, focusForField, type PreviewFocus } from './focus'

export function PreviewFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<PreviewFocus | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const onFocus = useCallback((e: FocusEvent<HTMLElement>) => {
    clearTimeout(timer.current)
    const el = e.target
    const name = el.getAttribute('data-field') || el.getAttribute('name') || el.id
    setFocus(name ? focusForField(name) : null)
  }, [])
  const onBlur = useCallback((e: FocusEvent<HTMLElement>) => {
    // Keep the highlight while focus moves within the form; clear shortly after it leaves
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    timer.current = setTimeout(() => setFocus(null), 150)
  }, [])
  const value = useMemo(() => ({ focus, onFocus, onBlur }), [focus, onFocus, onBlur])
  return <FocusCtx.Provider value={value}>{children}</FocusCtx.Provider>
}
