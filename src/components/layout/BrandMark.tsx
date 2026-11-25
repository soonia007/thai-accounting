import { cn } from '@/lib/utils'

/** App logo: bar chart on a Mermaid Blue → Deep Blue tile (same artwork as public/favicon.svg). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden className={cn('size-8 shrink-0', className)}>
      <defs>
        <linearGradient id="brand-g" x1="8" x2="56" y1="4" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2690CF" />
          <stop offset="1" stopColor="#0B56A4" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill="url(#brand-g)" rx="15" />
      <path stroke="#fff" strokeLinecap="round" strokeWidth="5" d="M18 44V30M29 44V22M40 44V34" />
      <path
        stroke="#fff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity=".9"
        strokeWidth="4"
        d="m37 24 6-6 5 5"
      />
    </svg>
  )
}
