import { FlaskConical, RotateCcw } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatedMoney } from '@/components/AnimatedNumber'
import { ActionGroup, PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { useCompany } from '@/features/company/CompanyProvider'
import { useMoneyAccounts } from '@/features/documents/queries'
import { PostingPreview } from '@/features/posting/PostingPreview'
import { usePostingSimulation } from '@/features/posting/simulation'
import { todayBangkok } from '@/lib/format'
import { calcDocument, NegativeLineError, type VatMode } from '@/lib/money/calc'
import { cn } from '@/lib/utils'

type TxType = 'invoice' | 'cash_sale' | 'bill' | 'cash_purchase'
type Kind = 'service' | 'product'

const WHT_STEPS = [0, 1, 1.5, 2, 3, 5]

interface State {
  type: TxType
  kind: Kind
  vatMode: VatMode
  price: number
  qty: number
  discountPct: number
  whtStep: number
}
const INITIAL: State = {
  type: 'invoice',
  kind: 'service',
  vatMode: 'exclusive',
  price: 10000,
  qty: 1,
  discountPct: 0,
  whtStep: 0,
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
  disabled?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'grid w-full rounded-xl bg-muted p-1',
        disabled && 'pointer-events-none opacity-50',
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-9 cursor-pointer rounded-lg px-2 text-xs font-semibold text-muted-foreground transition-all duration-300 sm:text-sm',
            value === o.value && 'bg-card text-foreground shadow-card',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Control({
  label,
  value,
  children,
}: {
  label: string
  value?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {value !== undefined && (
          <span className="text-sm font-semibold text-brand-strong tabular-nums">{value}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function Slider({
  min,
  max,
  step,
  value,
  onChange,
  label,
}: {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  label: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="finora-range"
      style={{ '--pct': `${pct}%` } as React.CSSProperties}
    />
  )
}

/**
 * Interactive sandbox: play with a transaction and watch the real posting engine
 * (simulate_posting — the same rules as posting) respond instantly. Nothing is saved.
 */
export function SandboxPage() {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const companyId = current!.id
  const vatRegistered = current!.vat_registered
  const vatRate = Number(current!.vat_rate)
  const { data: money = [] } = useMoneyAccounts(companyId)
  const [s, setS] = useState<State>(INITIAL)
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }))

  const isSale = s.type === 'invoice' || s.type === 'cash_sale'
  const isCash = s.type === 'cash_sale' || s.type === 'cash_purchase'
  const vatMode: VatMode = vatRegistered ? s.vatMode : 'none'
  const wht = WHT_STEPS[s.whtStep]
  const gross = Math.round(s.price * s.qty * 100) / 100
  const discount = Math.round(gross * s.discountPct) / 100

  const totals = useMemo(() => {
    try {
      return calcDocument(
        [
          {
            qty: s.qty,
            unitPrice: s.price,
            discount,
            vatRate: vatMode === 'none' ? 0 : vatRate,
            whtRate: wht,
            itemKind: s.kind,
          },
        ],
        vatMode,
      )
    } catch (e) {
      if (e instanceof NegativeLineError) return null
      throw e
    }
  }, [s.qty, s.price, discount, vatMode, vatRate, wht, s.kind])

  const payload = {
    company_id: companyId,
    type: s.type,
    doc_date: todayBangkok(),
    vat_mode: vatMode,
    payment_account_id: isCash ? (money[0]?.id ?? null) : null,
    lines: [
      {
        description: t('sandbox.lineDescription'),
        item_kind: s.kind,
        qty: s.qty,
        unit_price: s.price,
        discount,
        vat_type: 'standard',
        wht_rate: wht,
        wht_income_type: !isSale && wht > 0 ? 'service' : null,
      },
    ],
  }
  const sim = usePostingSimulation('document', s.price > 0 ? payload : null)
  const m = (v: number) => (
    <AnimatedMoney value={v} lang={i18n.language} className="font-semibold" />
  )

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        icon={FlaskConical}
        section={t('sections.overview')}
        title={t('sandbox.title')}
        description={t('sandbox.subtitle')}
        actions={
          <ActionGroup label={t('actionGroups.tools')}>
            <Button variant="outline" size="sm" onClick={() => setS(INITIAL)}>
              <RotateCcw className="size-4" />
              {t('sandbox.reset')}
            </Button>
          </ActionGroup>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Controls */}
        <section
          aria-label={t('sandbox.controls')}
          className="flex flex-col gap-5 self-start rounded-2xl border border-border/70 bg-card p-5 shadow-card lg:sticky lg:top-8"
        >
          <Control label={t('sandbox.transaction')}>
            <Segmented
              label={t('sandbox.transaction')}
              value={s.type}
              onChange={(v) => set('type', v)}
              options={[
                { value: 'invoice', label: t('sandbox.types.invoice') },
                { value: 'cash_sale', label: t('sandbox.types.cash_sale') },
                { value: 'bill', label: t('sandbox.types.bill') },
                { value: 'cash_purchase', label: t('sandbox.types.cash_purchase') },
              ]}
            />
          </Control>
          <div className="grid gap-5 sm:grid-cols-2">
            <Control label={t('sandbox.kind')}>
              <Segmented
                label={t('sandbox.kind')}
                value={s.kind}
                onChange={(v) => set('kind', v)}
                options={[
                  { value: 'service', label: t('products.kinds.service') },
                  { value: 'product', label: t('products.kinds.product') },
                ]}
              />
            </Control>
            <Control label={t('docs.vatMode')}>
              <Segmented
                label={t('docs.vatMode')}
                value={vatMode}
                disabled={!vatRegistered}
                onChange={(v) => set('vatMode', v)}
                options={[
                  { value: 'exclusive', label: t('sandbox.vat.exclusive') },
                  { value: 'inclusive', label: t('sandbox.vat.inclusive') },
                  { value: 'none', label: t('sandbox.vat.none') },
                ]}
              />
            </Control>
          </div>
          {!vatRegistered && (
            <p className="-mt-3 text-xs text-muted-foreground">{t('sandbox.notVatRegistered')}</p>
          )}
          <Control
            label={t('lines.price')}
            value={new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'th-TH').format(
              s.price,
            )}
          >
            <Slider
              label={t('lines.price')}
              min={0}
              max={200000}
              step={500}
              value={s.price}
              onChange={(v) => set('price', v)}
            />
          </Control>
          <Control label={t('lines.qty')} value={s.qty}>
            <Slider
              label={t('lines.qty')}
              min={1}
              max={20}
              step={1}
              value={s.qty}
              onChange={(v) => set('qty', v)}
            />
          </Control>
          <Control label={t('lines.discount')} value={`${s.discountPct}%`}>
            <Slider
              label={t('lines.discount')}
              min={0}
              max={30}
              step={1}
              value={s.discountPct}
              onChange={(v) => set('discountPct', v)}
            />
          </Control>
          <Control label={t('lines.wht')} value={wht === 0 ? '—' : `${wht}%`}>
            <Slider
              label={t('lines.wht')}
              min={0}
              max={WHT_STEPS.length - 1}
              step={1}
              value={s.whtStep}
              onChange={(v) => set('whtStep', v)}
            />
            <div className="flex justify-between px-0.5 text-[11px] text-muted-foreground">
              {WHT_STEPS.map((w) => (
                <span key={w}>{w === 0 ? '0' : `${w}%`}</span>
              ))}
            </div>
          </Control>
        </section>

        {/* Live results */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [t('totals.subtotal'), totals?.subtotal ?? 0],
              [t('totals.vat'), totals?.vatTotal ?? 0],
              [t('totals.total'), totals?.total ?? 0],
              [isCash ? t('totals.net') : t('totals.netExpected'), totals?.netTotal ?? 0],
            ].map(([label, v], i) => (
              <div
                key={String(label)}
                className={cn(
                  'flex flex-col gap-1 rounded-2xl border border-border/70 bg-card p-4 shadow-card',
                  i === 3 &&
                    'border-transparent bg-gradient-to-br from-finora-cobalt to-[#0b5fd0] text-white',
                )}
              >
                <span
                  className={cn('text-xs', i === 3 ? 'text-white/80' : 'text-muted-foreground')}
                >
                  {label}
                </span>
                <span className="text-lg sm:text-xl">{m(Number(v))}</span>
              </div>
            ))}
          </div>
          {wht > 0 && totals && (
            <p className="rounded-xl bg-finora-mint/10 px-4 py-2.5 text-sm">
              {t('sandbox.whtNote', {
                amount: new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'th-TH', {
                  minimumFractionDigits: 2,
                }).format(totals.whtTotal),
                when: isCash ? t('sandbox.whtNow') : t('sandbox.whtLater'),
              })}
            </p>
          )}
          <PostingPreview result={sim.data} isFetching={sim.isFetching} error={sim.error} inline />
          <p className="text-xs text-muted-foreground">{t('sandbox.disclaimer')}</p>
        </div>
      </div>
    </div>
  )
}
