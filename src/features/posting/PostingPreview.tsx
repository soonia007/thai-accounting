import {
  Banknote,
  ChevronDown,
  ChevronUp,
  Circle,
  FileClock,
  Hourglass,
  Landmark,
  Maximize2,
  X,
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
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AnimatedMoney } from '@/components/AnimatedNumber'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  isDebitNormal,
  normalBalance,
  plainSentence,
  type SimLine,
  type SimResult,
} from './simulation'
import { isAffected, usePreviewFocus, type PreviewFocus } from './focus'

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
    <Badge variant={ok ? 'success' : 'danger'} className="gap-1.5">
      <span className={cn('size-1.5 rounded-full', ok ? 'bg-success' : 'bg-destructive')} />
      {ok
        ? t('preview.balanced')
        : t('preview.unbalanced', { diff: formatMoney(Math.abs(dr - cr)) })}
    </Badge>
  )
}

/** Row look when a form field is focused: affected lines glow mint, others step back. */
const focusRow = (focus: PreviewFocus | null, l: SimLine) =>
  !focus || focus.sources.length === 0
    ? ''
    : isAffected(focus, l.sources)
      ? 'bg-finora-mint/12 shadow-[inset_3px_0_0_var(--finora-mint)]'
      : 'opacity-45'

function PlainSummary({ lines }: { lines: SimLine[] }) {
  const { t, i18n } = useTranslation()
  const focus = usePreviewFocus()
  return (
    <ul className="flex flex-col gap-2 rounded-xl bg-accent/60 p-3.5 text-sm leading-snug">
      {lines.map((l) => {
        const { key, icon } = plainSentence(l)
        const Icon = ICONS[icon] ?? Circle
        const amount = formatMoney(Number(l.debit) || Number(l.credit), i18n.language)
        const name = i18n.language === 'en' ? l.name_en || l.name_th : l.name_th
        return (
          <li
            key={`${l.account_id}-${l.debit > 0 ? 'd' : 'c'}`}
            className={cn(
              '-mx-1.5 flex gap-2 rounded-lg px-1.5 py-0.5 transition-all duration-300',
              focusRow(focus, l),
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span>{t(key, { amount, name, defaultValue: `${name} ${amount}` })}</span>
          </li>
        )
      })}
    </ul>
  )
}

function JournalView({ lines }: { lines: SimLine[] }) {
  const { t, i18n } = useTranslation()
  const focus = usePreviewFocus()
  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b text-xs text-muted-foreground">
          <th className="w-[55%] py-1.5 text-left font-medium">{t('preview.account')}</th>
          <th className="py-1.5 text-right font-medium">{t('preview.debit')}</th>
          <th className="py-1.5 text-right font-medium">{t('preview.credit')}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr
            key={`${l.account_id}-${l.debit > 0 ? 'd' : 'c'}`}
            className={cn(
              'border-b border-border/60 transition-all duration-300',
              focusRow(focus, l),
            )}
          >
            <td className={cn('truncate py-2', l.credit > 0 && 'pl-5')}>
              <span className="font-mono text-xs text-muted-foreground">{l.code}</span>{' '}
              {i18n.language === 'en' ? l.name_en || l.name_th : l.name_th}
            </td>
            <td className="py-2 text-right tabular-nums">
              {l.debit > 0 ? <AnimatedMoney value={Number(l.debit)} lang={i18n.language} /> : ''}
            </td>
            <td className="py-2 text-right tabular-nums">
              {l.credit > 0 ? <AnimatedMoney value={Number(l.credit)} lang={i18n.language} /> : ''}
            </td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td className="py-2">{t('preview.total')}</td>
          <td className="py-2 text-right tabular-nums">
            <AnimatedMoney value={sum(lines, 'debit')} lang={i18n.language} />
          </td>
          <td className="py-2 text-right tabular-nums">
            <AnimatedMoney value={sum(lines, 'credit')} lang={i18n.language} />
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function TAccountView({ lines, wide }: { lines: SimLine[]; wide?: boolean }) {
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
    <div className={cn('grid grid-cols-1 gap-2.5', wide && 'sm:grid-cols-2 2xl:grid-cols-3')}>
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
          <div className="flex justify-between gap-1 font-semibold text-brand-strong">
            <span>{t('preview.thisDoc')}</span>
            <span className="tabular-nums">{formatMoney(amount, i18n.language)}</span>
          </div>
        )
        return (
          <div key={l.account_id} className="overflow-hidden rounded-xl border bg-card text-xs">
            <div className="truncate border-b-2 bg-muted/50 px-2 py-1.5 text-center font-medium">
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
            <div className="flex justify-between border-t px-2 py-1.5 text-muted-foreground">
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

/** "Editing: Unit price (line 1) → affects Revenue, Output VAT, Receivables" */
function FocusCallout({ result }: { result: SimResult | undefined }) {
  const { t, i18n } = useTranslation()
  const focus = usePreviewFocus()
  if (!focus) return null
  const field = t(`focus.fields.${focus.field}`, { defaultValue: focus.field })
  const label = focus.line ? t('focus.onLine', { field, line: focus.line }) : field
  const all = result?.ok ? [...result.lines, ...(result.next?.lines ?? [])] : []
  const names = [
    ...new Set(
      all
        .filter((l) => isAffected(focus, l.sources))
        .map((l) => (i18n.language === 'en' ? l.name_en || l.name_th : l.name_th)),
    ),
  ]
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-overlay-in mb-3 flex items-start gap-2.5 rounded-xl border border-finora-mint/60 bg-finora-mint/10 p-3 text-sm"
    >
      <span className="mt-1 size-2 shrink-0 animate-pulse rounded-full bg-finora-mint" />
      <span className="min-w-0">
        <span className="font-semibold">{t('focus.editing', { field: label })}</span>
        <span className="block text-muted-foreground">
          {focus.sources.length === 0
            ? t('focus.noEffect')
            : names.length > 0
              ? t('focus.affects', { accounts: names.join(', ') })
              : t('focus.affectsLater')}
        </span>
      </span>
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
    return (
      <>
        <FocusCallout result={result} />
        <p className="text-sm text-muted-foreground">{t('preview.fillForm')}</p>
      </>
    )
  }
  if (!result.ok) {
    return (
      <div className="rounded-xl border border-dashed p-3.5 text-sm text-muted-foreground">
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
      className="inline-flex rounded-full bg-muted p-0.5"
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
            'cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-all',
            view === v ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground',
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
      <FocusCallout result={result} />
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

function ExpandButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={t('preview.expand')}
      title={t('preview.expand')}
    >
      <Maximize2 className="size-4" />
    </Button>
  )
}

/**
 * Full-screen simulation: plain-language summary, journal and T-accounts side by side,
 * then the "next step" (settlement) the same way. Esc or ✕ closes it.
 */
function FullscreenPreview({
  result,
  isFetching,
  noPosting,
  onClose,
}: Props & { onClose: () => void }) {
  const { t } = useTranslation()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const section = (lines: SimLine[], title?: string) => (
    <section className="flex flex-col gap-4">
      {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col gap-4">
          <PlainSummary lines={lines} />
          <div className="rounded-2xl border bg-card p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{t('preview.journal')}</span>
              <BalanceBadge lines={lines} />
            </div>
            <JournalView lines={lines} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('preview.tAccount')}</span>
          <TAccountView lines={lines} wide />
        </div>
      </div>
    </section>
  )

  let content: React.ReactNode
  if (!result || !result.ok || (result.lines.length === 0 && !result.next?.lines.length)) {
    content = <PanelBody result={result} isFetching={isFetching} noPostingNote={noPosting} />
  } else {
    content = (
      <div className={cn('flex flex-col gap-8', isFetching && 'opacity-70 transition-opacity')}>
        {result.lines.length > 0 ? section(result.lines) : null}
        {result.next && result.next.lines.length > 0 && (
          <div className="border-t pt-6">
            {section(result.next.lines, t(`preview.next.${result.next.type}`))}
          </div>
        )}
      </div>
    )
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('preview.title')}
      className="animate-overlay-in fixed inset-0 z-50 flex flex-col bg-background"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/70 bg-card/85 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-xl md:px-8">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent">
            <Scale className="size-4 text-brand" aria-hidden />
          </span>
          {t('preview.title')}
        </h2>
        <Button variant="outline" size="sm" onClick={onClose} autoFocus>
          <X className="size-4" />
          {t('preview.close')}
        </Button>
      </header>
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-[1600px]">{content}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Desktop: sticky side panel. Use together with <PostingPreviewSheet> for mobile. */
export function PostingPreview({ result, isFetching, noPosting }: Props) {
  const { t } = useTranslation()
  const [full, setFull] = useState(false)
  return (
    <aside className="hidden max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-2xl border border-border/70 bg-card p-5 shadow-card md:sticky md:top-8 md:block">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent">
            <Scale className="size-4 text-brand" aria-hidden />
          </span>
          {t('preview.title')}
        </h2>
        <ExpandButton onClick={() => setFull(true)} />
      </div>
      <PanelBody result={result} isFetching={isFetching} noPostingNote={noPosting} />
      {full && (
        <FullscreenPreview
          result={result}
          isFetching={isFetching}
          noPosting={noPosting}
          onClose={() => setFull(false)}
        />
      )}
    </aside>
  )
}

/** Mobile: collapsible bar above the bottom navigation, with a full-screen view. */
export function PostingPreviewSheet({ result, isFetching, noPosting }: Props) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [full, setFull] = useState(false)
  const focus = usePreviewFocus()
  const focusField = focus ? t(`focus.fields.${focus.field}`, { defaultValue: focus.field }) : ''
  const headline = focus
    ? t('focus.editing', {
        field: focus.line ? t('focus.onLine', { field: focusField, line: focus.line }) : focusField,
      })
    : result?.ok && result.lines.length > 0
      ? (() => {
          const first = result.lines[0]
          const name = i18n.language === 'en' ? first.name_en || first.name_th : first.name_th
          return `${name} ${first.debit > 0 ? '+' : '−'}${formatMoney(first.debit || first.credit, i18n.language)}`
        })()
      : ''
  return (
    <div className="fixed inset-x-2 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-raised backdrop-blur-xl md:hidden">
      <div className="flex items-center">
        <button
          type="button"
          className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 px-4 py-2.5"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium whitespace-nowrap">
            <Scale className="size-4 shrink-0 text-brand" aria-hidden />
            {t('preview.title')}
            {result?.ok && result.lines.length > 0 && <BalanceBadge lines={result.lines} />}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="hidden truncate min-[420px]:inline">
              {open ? t('preview.hide') : headline}
            </span>
            {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </span>
        </button>
        <div className="pr-2">
          <ExpandButton onClick={() => setFull(true)} />
        </div>
      </div>
      {open && (
        <div className="max-h-[55dvh] overflow-y-auto px-4 pb-4">
          <PanelBody result={result} isFetching={isFetching} noPostingNote={noPosting} />
        </div>
      )}
      {full && (
        <FullscreenPreview
          result={result}
          isFetching={isFetching}
          noPosting={noPosting}
          onClose={() => setFull(false)}
        />
      )}
    </div>
  )
}

/** The journal actually recorded for a posted document or payment (incl. reversals when voided). */
export function PostedJournal({ entries }: { entries: { label: string; lines: SimLine[] }[] }) {
  const { t } = useTranslation()
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-card">
      <h2 className="mb-4 flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent">
          <Scale className="size-4 text-brand" aria-hidden />
        </span>
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
