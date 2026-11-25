import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '@/features/company/CompanyProvider'
import { todayBangkok } from '@/lib/format'
import { periodRange, type PeriodPreset } from './period'

const ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Report filters live in the URL (?cos=a,b&from=…&to=…) so a report can be bookmarked / shared and
 * survives a refresh. Defaults: the current company, 1 Jan of this year → today.
 */
export function useReportScope() {
  const { companies, current } = useCompany()
  const [params, setParams] = useSearchParams()
  const today = todayBangkok()

  const mine = useMemo(() => new Set(companies.map((c) => c.id)), [companies])
  const fromUrl = (params.get('cos') ?? '').split(',').filter((id) => mine.has(id))
  const companyIds = fromUrl.length > 0 ? fromUrl : current ? [current.id] : []

  const dflt = periodRange('thisYear', today)
  const f = params.get('from')
  const t = params.get('to')
  const from = f && ISO.test(f) ? f : dflt.from
  const to = t && ISO.test(t) ? t : dflt.to

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) next.delete(k)
          else next.set(k, v)
        }
        return next
      },
      { replace: true },
    )

  return {
    today,
    companyIds,
    from,
    to,
    setCompanies: (ids: string[]) => update({ cos: ids.length ? ids.join(',') : null }),
    setRange: (nf: string, nt: string) => update({ from: nf, to: nt }),
    setAsOf: (nt: string) => update({ to: nt }),
    applyPreset: (p: PeriodPreset) => {
      const r = periodRange(p, today)
      update({ from: r.from, to: r.to })
    },
  }
}

export type ReportScope = ReturnType<typeof useReportScope>
