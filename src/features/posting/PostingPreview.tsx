import {
  Banknote,
  ChevronDown,
  ChevronUp,
  Circle,
  FileClock,
  Hourglass,
  Landmark,
  Package,
  Receipt,
  Scale,
  Store,
  TrendingDown,
  TrendingUp,
  Undo2,
  User,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  isDebitNormal,
  normalBalance,
  plainSentence,
  type SimLine,
  type SimResult,
} from './simulation'

const ICONS: Record<string, LucideIcon> = {
  user: User,
  store: Store,
  landmark: Landmark,
  hourglass: Hourglass,
  receipt: Receipt,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  undo: Undo2,
  banknote: Banknote,
  package: Package,
  'file-clock': FileClock,
  scale: Scale,
  circle: Circle,
}

type View = 'journal' | 't'
const VIEW_KEY = 'postingPreviewView'

function useView(): [View, (v: View) => void] {
  const [view, setView] = useState<View>(() =>
    localStorage.getItem(VIEW_KEY) === 't' ? 't' : 'journal',
  )
  return [
    view,
    (v) => {
      localStorage.setItem(VIEW_KEY, v)
      setView(v)
    },
  ]
}

const sum = (lines: SimLine[], k: 'debit' | 'credit') =>
  Math.round(lines.reduce((s, l) => s + Number(l[k]), 0) * 100) / 100

function BalanceBadge({ lines }: { lines: SimLine[] }) {
  const { t } = useTranslation()
  const dr = sum(lines, 'debit')
  const cr = sum(lines, 'credit')
  const ok = dr === cr
  return (
    <Badge
      className={cn(
        'font-normal',
        ok
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
          : 'bg-red-100 text-red-800',
      )}
    >
      {ok
        ? t('preview.balanced')
        : t('preview.unbalanced', { diff: formatMoney(Math.abs(dr - cr)) })}
    </Badge>
  )
}

function PlainSummary({ lines }: { lines: SimLine[] }) {
  const { t, i18n } = useTranslation()
  return (
    <ul className="flex flex-col gap-1.5 rounded-md bg-muted/60 p-3 text-sm">
      {lines.map((l) => {
        const { key, icon } = plainSentence(l)
        const Icon = ICONS[icon] ?? Circle
        const amount = formatMoney(Number(l.debit) || Number(l.credit), i18n.language)
        const name = i18n.language === 'en' ? l.name_en || l.name_th : l.name_th
        return (
          <li key={`${l.account_id}-${l.debit > 0 ? 'd' : 'c'}`} className="flex gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>{t(key, { amount, name, defaultValue: `${name} ${amount}` })}</span>
          </li>
        )
      })}
    </ul>
  )
}

function JournalView({ lines }: { lines: SimLine[] }) {
  const { t, i18n } = useTranslation()
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b text-xs text-muted-foreground">
          <th className="w-[55%] py-1 text-left font-normal">{t('preview.account')}</th>
          <th className="py-1 text-right font-normal">{t('preview.debit')}</th>
          <th className="py-1 text-right font-normal">{t('preview.credit')}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={`${l.account_id}-${l.debit > 0 ? 'd' : 'c'}`} className="border-b">
            <td className={cn('truncate py-1.5', l.credit > 0 && 'pl-4')}>
              <span className="font-mono text-xs text-muted-foreground">{l.code}</span>{' '}
              {i18n.language === 'en' ? l.name_en || l.name_th : l.name_th}
            </td>
            <td className="py-1.5 text-right tabular-nums">
              {l.debit > 0 ? formatMoney(l.debit, i18n.language) : ''}
            </td>
            <td className="py-1.5 text-right tabular-nums">
              {l.credit > 0 ? formatMoney(l.credit, i18n.language) : ''}
            </td>
          </tr>
        ))}
        <tr className="font-medium">
          <td className="py-1.5">{t('preview.total')}</td>
          <td className="py-1.5 text-right tabular-nums">
            {formatMoney(sum(lines, 'debit'), i18n.language)}
          </td>
          <td className="py-1.5 text-right tabular-nums">
            {formatMoney(sum(lines, 'credit'), i18n.language)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function TAccountView({ lines }: { lines: SimLine[] }) {
  const { t, i18n } = useTranslation()
  // One card per account (an account can appear on both sides)
  const byAccount = new Map<string, { line: SimLine; debit: number; credit: number }>()
  for (const l of lines) {
    const cur = byAccount.get(l.account_id) ?? { line: l, debit: 0, credit: 0 }
    cur.debit += Number(l.debit)
    cur.credit += Number(l.credit)
    byAccount.set(l.account_id, cur)
  }
  return (
    <div className="grid grid-cols-1 gap-2">
      {[...byAccount.values()].map(({ line: l, debit, credit }) => {
        const opening = Number(l.opening_balance)
        const openingNormal = normalBalance(l.type, opening)
        const closing = normalBalance(l.type, opening + debit - credit)
        const openingRow = (
          <div className="flex justify-between gap-1 text-muted-foreground">
            <span>{t('preview.opening')}</span>
            <span className="tabular-nums">{formatMoney(openingNormal, i18n.language)}</span>
          </div>
        )
        const docRow = (amount: number) => (
          <div className="flex justify-between gap-1 font-medium text-primary">
            <span>{t('preview.thisDoc')}</span>
            <span className="tabular-nums">{formatMoney(amount, i18n.language)}</span>
          </div>
        )
        return (
          <div key={l.account_id} className="rounded-md border text-xs">
            <div className="truncate border-b-2 px-2 py-1 text-center font-medium">
              {l.code} {i18n.language === 'en' ? l.name_en || l.name_th : l.name_th}
            </div>
            <div className="grid grid-cols-2">
              <div className="min-h-12 border-r-2 p-1.5">
                {isDebitNormal(l.type) && openingRow}
                {debit > 0 && docRow(debit)}
              </div>
              <div className="min-h-12 p-1.5">
                {!isDebitNormal(l.type) && openingRow}
                {credit > 0 && docRow(credit)}
              </div>
            </div>
            <div className="flex justify-between border-t px-2 py-1 text-muted-foreground">
              <span>
                {t('preview.closing')} ({isDebitNormal(l.type) ? 'Dr' : 'Cr'})
              </span>
              <span className="font-medium text-foreground tabular-nums">
                {formatMoney(closing, i18n.language)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PanelBody({
  result,
  isFetching,
  compact,
  noPostingNote,
}: {
  result: SimResult | undefined
  isFetching: boolean
  compact?: boolean
  noPostingNote?: boolean
}) {
  const { t } = useTranslation()
  const [view, setView] = useView()

  if (!result) {
    return <p className="text-sm text-muted-foreground">{t('preview.fillForm')}</p>
  }
  if (!result.ok) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        {t(`dbErrors.${result.error}`, { defaultValue: t('preview.cannotPreview') })}
        {result.error === 'MAPPING_MISSING' && (
          <Link to="/accounting/mappings" className="ml-1 text-primary underline">
            {t('mappings.title')}
          </Link>
        )}
      </div>
    )
  }

  const viewToggle = (
    <div
      className="inline-flex rounded-md border p-0.5"
      role="group"
      aria-label={t('preview.view')}
    >
      {(['journal', 't'] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={cn(
            'rounded px-2 py-0.5 text-xs',
            view === v ? 'bg-muted font-medium' : 'text-muted-foreground',
          )}
        >
          {v === 'journal' ? t('preview.journal') : t('preview.tAccount')}
        </button>
      ))}
    </div>
  )

  const body = (lines: SimLine[]) =>
    view === 'journal' ? <JournalView lines={lines} /> : <TAccountView lines={lines} />

  return (
    <div className={cn('flex flex-col gap-3', isFetching && 'opacity-70 transition-opacity')}>
      {result.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {noPostingNote ? t('preview.noPosting') : t('preview.fillForm')}
        </p>
      ) : (
        <>
          <PlainSummary lines={result.lines} />
          <div className="flex items-center justify-between gap-2">
            <BalanceBadge lines={result.lines} />
            {viewToggle}
          </div>
          {body(result.lines)}
        </>
      )}
      {result.next && result.next.lines.length > 0 && !compact && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium">{t(`preview.next.${result.next.type}`)}</h3>
            {result.lines.length === 0 && viewToggle}
          </div>
          <PlainSummary lines={result.next.lines} />
          {body(result.next.lines)}
        </div>
      )}
    </div>
  )
}

interface Props {
  result: SimResult | undefined
  isFetching: boolean
  /** e.g. quotation / purchase order: show "this document does not post" */
  noPosting?: boolean
}

/** Desktop: sticky side panel. Use together with <PostingPreviewSheet> for mobile. */
export function PostingPreview({ result, isFetching, noPosting }: Props) {
  const { t } = useTranslation()
  return (
    <aside className="hidden rounded-xl border bg-card p-4 md:sticky md:top-4 md:block">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Scale className="size-4" aria-hidden />
        {t('preview.title')}
      </h2>
      <PanelBody result={result} isFetching={isFetching} noPostingNote={noPosting} />
    </aside>
  )
}

/** Mobile: collapsible bar above the bottom navigation. */
export function PostingPreviewSheet({ result, isFetching, noPosting }: Props) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const headline =
    result?.ok && result.lines.length > 0
      ? (() => {
          const first = result.lines[0]
          const name = i18n.language === 'en' ? first.name_en || first.name_th : first.name_th
          return `${name} ${first.debit > 0 ? '+' : '−'}${formatMoney(first.debit || first.credit, i18n.language)}`
        })()
      : ''
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 border-t bg-background shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:hidden">
      <Button
        variant="ghost"
        className="flex h-auto w-full items-center justify-between gap-2 rounded-none px-4 py-2"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Scale className="size-4 shrink-0" aria-hidden />
          {t('preview.title')}
          {result?.ok && result.lines.length > 0 && <BalanceBadge lines={result.lines} />}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span className="truncate">{open ? t('preview.hide') : headline}</span>
          {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </span>
      </Button>
      {open && (
        <div className="max-h-[60dvh] overflow-y-auto px-4 pb-4">
          <PanelBody result={result} isFetching={isFetching} noPostingNote={noPosting} />
        </div>
      )}
    </div>
  )
}

/** The journal actually recorded for a posted document or payment (incl. reversals when voided). */
export function PostedJournal({ entries }: { entries: { label: string; lines: SimLine[] }[] }) {
  const { t } = useTranslation()
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Scale className="size-4" aria-hidden />
        {t('preview.posted')}
      </h2>
      <div className="flex flex-col gap-4">
        {entries.map((e) => (
          <div key={e.label} className="flex flex-col gap-2">
            {entries.length > 1 && <h3 className="text-xs text-muted-foreground">{e.label}</h3>}
            <PlainSummary lines={e.lines} />
            <JournalView lines={e.lines} />
          </div>
        ))}
      </div>
    </section>
  )
}
