import { useEffect, useRef, useState, type RefObject } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * Scroll reveal: every `[data-reveal]` inside `root` fades/rises in once it enters the viewport
 * (CSS in index.css). Without IntersectionObserver (tests, old browsers) everything is shown.
 */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
      items.forEach((i) => i.setAttribute('data-shown', ''))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute('data-shown', '')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.12 },
    )
    items.forEach((i) => io.observe(i))
    return () => io.disconnect()
  }, [root])
}

/**
 * Parallax: writes the scroll offset to `--sy` (unitless px) on `root`, once per frame.
 * Elements use it in CSS, e.g. `translate3d(0, calc(var(--sy) * -0.1px), 0)`.
 */
export function useScrollVar(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el || prefersReducedMotion()) return
    let frame = 0
    const update = () => {
      frame = 0
      el.style.setProperty('--sy', String(Math.round(window.scrollY)))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [root])
}

/** Sticky showcase: index of the step currently in the middle of the viewport. */
export function useActiveStep(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step))
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    refs.current.slice(0, count).forEach((r) => r && io.observe(r))
    return () => io.disconnect()
  }, [count])
  return { active, refs }
}
