import { useQuery } from '@tanstack/react-query'
import { Check, ChevronRight, Rocket, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Step {
  key: 'company' | 'contacts' | 'products' | 'sale' | 'purchase' | 'report'
  to: string
  done: boolean
}

const storeKey = (companyId: string) => `finora.gettingStarted.hidden.${companyId}`
const readHidden = (companyId: string) => {
  try {
    return localStorage.getItem(storeKey(companyId)) === '1'
  } catch {
    return false
  }
}

async function count(table: 'contacts' | 'products', companyId: string) {
  const { count: n } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
  return n ?? 0
}

/**
 * First steps for a new company: what to set up, in order, each one a click away. Ticks itself
 * off from the real data; hides when everything is done (or when the user dismisses it).
 */
export function GettingStarted({ companyId }: { companyId: string }) {
  const { t } = useTranslation()
  const [hidden, setHidden] = useState(() => readHidden(companyId))
  const q = useQuery({
    queryKey: ['getting-started', companyId],
    enabled: !hidden,
    queryFn: async () => {
      const [company, contacts, products, sales, purchases] = await Promise.all([
        supabase.from('companies').select('address, logo_path').eq('id', companyId).single(),
        count('contacts', companyId),
        count('products', companyId),
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .neq('status', 'draft')
          .in('type', ['invoice', 'cash_sale']),
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .neq('status', 'draft')
          .in('type', ['bill', 'cash_purchase']),
      ])
      return {
        company: !!(company.data?.address || company.data?.logo_path),
        contacts: contacts > 0,
        products: products > 0,
        sale: (sales.count ?? 0) > 0,
        purchase: (purchases.count ?? 0) > 0,
      }
    },
  })
  if (hidden || !q.data) return null

  const steps: Step[] = [
    { key: 'company', to: '/settings/company', done: q.data.company },
    { key: 'contacts', to: '/contacts', done: q.data.contacts },
    { key: 'products', to: '/products', done: q.data.products },
    { key: 'sale', to: '/sales/new/invoice', done: q.data.sale },
    { key: 'purchase', to: '/purchases/new/bill', done: q.data.purchase },
    { key: 'report', to: '/reports/trial-balance', done: q.data.sale && q.data.purchase },
  ]
  const done = steps.filter((s) => s.done).length
  if (done === steps.length) return null
  const next = steps.find((s) => !s.done)

  const dismiss = () => {
    try {
      localStorage.setItem(storeKey(companyId), '1')
    } catch {
      /* storage unavailable: hide for this visit only */
    }
    setHidden(true)
  }

  return (
    <section
      aria-label={t('gettingStarted.title')}
      className="relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-accent via-card to-card p-5 shadow-card"
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 size-8"
        aria-label={t('gettingStarted.dismiss')}
        onClick={dismiss}
      >
        <X className="size-4" />
      </Button>
      <div className="flex items-start gap-3 pr-10">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-finora-sky to-finora-cobalt text-white shadow-raised">
          <Rocket className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t('gettingStarted.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('gettingStarted.subtitle')}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={done}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-finora-cobalt via-finora-sky to-finora-mint transition-all duration-700"
            style={{ width: `${(done / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {t('gettingStarted.progress', { done, total: steps.length })}
        </span>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link
              to={s.to}
              className={cn(
                'group flex h-full items-start gap-3 rounded-xl border bg-card p-3 transition-all hover:-translate-y-px hover:border-brand hover:shadow-card',
                s === next && 'border-brand/50 ring-2 ring-finora-mint/40',
                s.done && 'opacity-70',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  s.done ? 'border-transparent bg-success text-white' : 'text-muted-foreground',
                )}
              >
                {s.done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-medium', s.done && 'line-through')}>
                  {t(`gettingStarted.steps.${s.key}.title`)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(`gettingStarted.steps.${s.key}.hint`)}
                </span>
              </span>
              {!s.done && (
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
