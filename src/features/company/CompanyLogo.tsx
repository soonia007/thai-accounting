import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { companyLogoUrl } from './logo'

/** The customer's company logo, or a tinted initial when none is uploaded. */
export function CompanyLogo({
  name,
  logoPath,
  className,
  wide,
}: {
  name: string | null | undefined
  logoPath: string | null | undefined
  className?: string
  /** keep the logo's own proportions (fixed height) instead of a square tile */
  wide?: boolean
}) {
  const url = companyLogoUrl(logoPath)
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-lg',
        url && wide ? 'h-10 max-w-44 px-2' : 'size-8',
        url
          ? 'bg-white ring-1 ring-border/70'
          : 'bg-accent text-sm font-semibold text-brand-strong',
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className={wide ? 'h-full w-auto object-contain py-1' : 'size-full object-contain p-0.5'}
        />
      ) : (
        name?.trim().charAt(0) || <Building2 className="size-4" />
      )}
    </span>
  )
}
