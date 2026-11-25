import { useId } from 'react'
import { cn } from '@/lib/utils'

/** FINORA "F" mark (vector trace of the owner's logo; same artwork as public/brand/finora-mark.svg). */
export function BrandMark({ className }: { className?: string }) {
  // Unique gradient ids per instance: a url(#id) pointing into a hidden (display:none) copy
  // of the logo, e.g. the desktop sidebar on phones, renders nothing.
  const uid = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="213 202 640 640"
      fill="none"
      aria-hidden
      className={cn('size-8 shrink-0', className)}
    >
      <defs>
        <linearGradient
          id={`fa-${uid}`}
          x1="640"
          y1="213"
          x2="230"
          y2="560"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0443A8" />
          <stop offset=".55" stopColor="#0447AE" />
          <stop offset="1" stopColor="#015BD3" />
        </linearGradient>
        <linearGradient
          id={`fb-${uid}`}
          x1="776"
          y1="416"
          x2="260"
          y2="590"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#1A8CF0" />
          <stop offset="1" stopColor="#1283EC" />
        </linearGradient>
        <linearGradient
          id={`fc-${uid}`}
          x1="400"
          y1="563"
          x2="228"
          y2="832"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#5EDFD0" />
          <stop offset="1" stopColor="#52DCCB" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#fa-${uid})`}
        d="M440 213H838L734 351Q714 377 681 377H436Q406 377 386 397L228 556V440Q228 394 260 359L366 246Q398 213 440 213Z"
      />
      <path fill="#0259D2" d="M228 556V446Q228 392 290 379Q300 377 318 377H436Q406 377 386 397Z" />
      <path
        fill={`url(#fc-${uid})`}
        d="M300 563H403V634Q403 662 383 682L228 832V632Q228 594 258 576Q275 563 300 563Z"
      />
      <path
        fill={`url(#fb-${uid})`}
        d="M442 416H776L672 547Q659 563 633 563H300Q268 563 244 590L404 432Q420 416 442 416Z"
      />
      <path fill="#1C7EE3" d="M244 590Q262 568 300 564H330Q280 566 252 586Z" opacity={0.55} />
    </svg>
  )
}

/** Mark + "FINORA" wordmark in brand cobalt (as on the owner's logo). */
export function BrandLogo({
  className,
  markClassName,
}: {
  className?: string
  markClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark className={markClassName} />
      <span className="text-[1.15em] font-extrabold tracking-[0.06em] text-finora-cobalt">
        FINORA
      </span>
    </span>
  )
}
