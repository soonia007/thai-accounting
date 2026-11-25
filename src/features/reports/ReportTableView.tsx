import { useTranslation } from 'react-i18next'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ReportTable } from './model'

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function ReportTableView({ table, era }: { table: ReportTable; era: 'BE' | 'CE' }) {
  const { i18n } = useTranslation()
  const firstText = table.columns.findIndex((c) => !c.money)
  const show = (v: string | number | null, dash: boolean) => {
    if (v === null) return ''
    if (typeof v === 'number') return dash && v === 0 ? '–' : formatMoney(v, i18n.language)
    return DATE.test(v) ? formatDate(v, era) : v
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/60 text-xs text-muted-foreground">
            {table.columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'px-3 py-2.5 font-medium',
                  c.align === 'right' ? 'text-right' : 'text-left',
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, ri) => {
            const kind = r.kind ?? 'normal'
            if (kind === 'section') {
              const label = r.cells.find((c) => c !== null)
              return (
                <tr key={ri} className="border-b bg-accent/60">
                  <th
                    scope="rowgroup"
                    colSpan={table.columns.length}
                    className="px-3 py-2 text-left font-semibold text-brand-strong"
                  >
                    {String(label ?? '')}
                  </th>
                </tr>
              )
            }
            return (
              <tr
                key={ri}
                className={cn(
                  'border-b last:border-b-0 hover:bg-muted/40',
                  kind === 'subtotal' && 'bg-muted/30 font-semibold',
                  kind === 'total' && 'border-t-2 border-t-brand/40 bg-accent/50 font-semibold',
                )}
              >
                {table.columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-3 py-2',
                      c.align === 'right' ? 'text-right tabular-nums' : 'text-left',
                      c.money &&
                        typeof r.cells[i] === 'number' &&
                        (r.cells[i] as number) < 0 &&
                        'text-destructive',
                      r.indent && i === firstText && 'pl-7',
                      (c.key === 'code' || c.key === 'seq') &&
                        kind === 'normal' &&
                        'font-mono text-xs text-muted-foreground',
                    )}
                  >
                    {show(r.cells[i], kind === 'normal')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
