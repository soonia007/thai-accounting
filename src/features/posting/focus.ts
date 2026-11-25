import { createContext, useContext, type FocusEvent } from 'react'

/**
 * Links the form field being edited to the simulation panel: the panel highlights the journal
 * lines that field can change (via the engine's `sources` tags) and says what is being edited.
 */
export interface PreviewFocus {
  /** i18n key under `focus.fields` */
  field: string
  /** 1-based line / allocation number, when the field belongs to one */
  line?: number
  /** engine `sources` this field affects; empty = does not affect the books */
  sources: string[]
}

const AMOUNT = ['line', 'returns', 'vat', 'vat_deferred', 'total', 'payment']
const TAX = ['vat', 'vat_deferred', 'vat_transfer', 'total', 'payment']
const WHT = ['wht', 'payment']

/** Form field name (react-hook-form `name`, element id or `data-field`) → what it affects. */
export function focusForField(name: string): PreviewFocus | null {
  const line = /^lines\.(\d+)\.(\w+)$/.exec(name)
  if (line) {
    const n = Number(line[1]) + 1
    const f = line[2]
    if (['qty', 'unit_price', 'discount', 'product_id'].includes(f))
      return { field: f, line: n, sources: AMOUNT }
    if (['vat_type', 'item_kind'].includes(f)) return { field: f, line: n, sources: TAX }
    if (['wht_rate', 'wht_income_type'].includes(f)) return { field: f, line: n, sources: WHT }
    if (f === 'account_id') return { field: f, line: n, sources: ['line', 'returns'] }
    return { field: f, line: n, sources: [] }
  }
  const jl = /^jl\.(\d+)\.(account_id|debit|credit|description)$/.exec(name)
  if (jl) {
    const n = Number(jl[1]) + 1
    return {
      field: `jl_${jl[2]}`,
      line: n,
      sources: jl[2] === 'description' ? [] : [`line:${n}`],
    }
  }
  const alloc = /^alloc\.(\d+)\.(amount|wht)$/.exec(name)
  if (alloc) {
    const n = Number(alloc[1]) + 1
    return alloc[2] === 'wht'
      ? { field: 'alloc_wht', line: n, sources: WHT }
      : { field: 'alloc_amount', line: n, sources: ['total', 'payment', 'vat_transfer', 'wht'] }
  }
  switch (name) {
    case 'contact_id':
    case 'd-contact':
    case 'p-contact':
      return { field: 'contact_id', sources: ['total'] }
    case 'ref_document_id':
    case 'd-ref':
      return { field: 'ref_document_id', sources: ['total', 'vat', 'vat_deferred'] }
    case 'vat_mode':
    case 'd-vat':
      return { field: 'vat_mode', sources: TAX }
    case 'payment_account_id':
    case 'd-money':
    case 'p-account':
      return { field: 'payment_account_id', sources: ['payment'] }
    case 'd-wht-condition':
    case 'p-wht-condition':
      return { field: 'wht_condition', sources: WHT }
    case 'doc_date':
    case 'd-date':
    case 'p-date':
      return { field: 'doc_date', sources: [] }
    case 'due_date':
    case 'd-due':
      return { field: 'due_date', sources: [] }
    case 'reference':
    case 'd-ref-text':
    case 'p-ref':
      return { field: 'reference', sources: [] }
    case 'notes':
    case 'd-notes':
      return { field: 'notes', sources: [] }
    default:
      return null
  }
}

/** True when a journal line is affected by the focused field. */
export const isAffected = (focus: PreviewFocus | null, sources: string[] | undefined) =>
  !!focus && (sources ?? []).some((s) => focus.sources.includes(s))

export interface FocusCtxValue {
  focus: PreviewFocus | null
  onFocus: (e: FocusEvent<HTMLElement>) => void
  onBlur: (e: FocusEvent<HTMLElement>) => void
}
export const FocusCtx = createContext<FocusCtxValue | null>(null)

/** Current focus (null outside a provider or when nothing relevant is focused). */
export function usePreviewFocus(): PreviewFocus | null {
  return useContext(FocusCtx)?.focus ?? null
}

/** Spread on the form element: `<form {...useFocusTracking()}>`. */
export function useFocusTracking() {
  const ctx = useContext(FocusCtx)
  return ctx ? { onFocus: ctx.onFocus, onBlur: ctx.onBlur } : {}
}
