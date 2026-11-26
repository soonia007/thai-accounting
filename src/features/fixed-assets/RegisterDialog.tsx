import { FileText, History, NotebookPen } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dbErrorMessage } from '@/features/accounts/errors'
import { monthLabel } from '@/features/vat/month'
import { formatDate, formatMoney, todayBangkok, type DateEra } from '@/lib/format'
import { cn } from '@/lib/utils'
import { schedule } from './model'
import { useRegister, type Category, type PendingLine } from './queries'

type Source = 'document' | 'opening' | 'recorded'
const num = (s: string) => Number(s.replace(/,/g, '').trim() || 0)

/**
 * Register an asset in three friendly ways: from a purchase already posted (nothing else to do),
 * as an opening balance (brings it into the books), or "already in the books". A live preview
 * shows the monthly depreciation and when the asset is fully depreciated.
 */
export function RegisterDialog({
  open,
  onClose,
  companyId,
  categories,
  pending,
  initialLineId,
  era,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  categories: Category[]
  pending: PendingLine[]
  initialLineId?: string | null
  era: DateEra
}) {
  const { t, i18n } = useTranslation()
  const reg = useRegister(companyId)
  const [source, setSource] = useState<Source>(pending.length ? 'document' : 'recorded')
  const [lineId, setLineId] = useState<string>('')
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(todayBangkok())
  const [cost, setCost] = useState('')
  const [salvage, setSalvage] = useState('')
  const [years, setYears] = useState('')
  const [openingAccum, setOpeningAccum] = useState('')
  const [openingDate, setOpeningDate] = useState(todayBangkok())

  const pick = (l: PendingLine | undefined) => {
    if (!l) return
    setLineId(l.line_id)
    setName(l.description)
    setDate(l.doc_date)
    setCost(String(l.cost))
    const cat = categories.find((c) => c.id === l.category_id)
    if (cat) {
      setCategoryId(cat.id)
      setYears(String(cat.default_life_months / 12))
    }
  }
  // when the dialog opens (possibly for one purchase line), preset the form — adjusted during
  // render rather than in an effect
  const openKey = open ? `open:${initialLineId ?? ''}` : null
  const [seenKey, setSeenKey] = useState<string | null>(null)
  if (openKey !== seenKey) {
    setSeenKey(openKey)
    if (open && initialLineId) {
      setSource('document')
      pick(pending.find((p) => p.line_id === initialLineId))
    } else if (open && pending.length) setSource('document')
  }

  const lifeMonths = Math.round(num(years) * 12)
  const ok =
    name.trim() &&
    categoryId &&
    num(cost) > 0 &&
    lifeMonths > 0 &&
    num(salvage) < num(cost) &&
    (source !== 'document' || lineId)
  const plan = useMemo(
    () =>
      ok
        ? schedule({
            acquired_on: date,
            cost: num(cost),
            salvage: num(salvage),
            life_months: lifeMonths,
          })
        : [],
    [ok, date, cost, salvage, lifeMonths],
  )
  const money = (v: number) => formatMoney(v, i18n.language)

  const close = () => {
    reg.reset()
    setLineId('')
    setName('')
    setCost('')
    setSalvage('')
    setOpeningAccum('')
    onClose()
  }
  const submit = () =>
    reg.mutate(
      {
        name,
        category_id: categoryId,
        source,
        source_line_id: source === 'document' ? lineId : null,
        acquired_on: date,
        cost: num(cost),
        salvage: num(salvage),
        life_months: lifeMonths,
        opening_accum: source === 'opening' ? num(openingAccum) : 0,
        opening_date: openingDate,
      },
      { onSuccess: close },
    )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('fa.register.title')}</DialogTitle>
          <DialogDescription>{t('fa.register.info')}</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ['document', FileText],
              ['opening', History],
              ['recorded', NotebookPen],
            ] as const
          ).map(([k, Icon]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={source === k}
              onClick={() => setSource(k)}
              className={cn(
                'cursor-pointer rounded-xl border p-3 text-left text-sm transition-colors hover:border-brand',
                source === k && 'border-brand bg-accent ring-2 ring-finora-mint/40',
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4 text-brand" />
                {t(`fa.register.sources.${k}`)}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t(`fa.register.sourceInfo.${k}`)}
              </span>
            </button>
          ))}
        </div>

        {source === 'document' && (
          <div className="grid gap-2">
            <Label htmlFor="fa-line">{t('fa.register.purchaseLine')}</Label>
            {pending.length === 0 ? (
              <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                {t('fa.register.noPending')}
              </p>
            ) : (
              <select
                id="fa-line"
                className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm"
                value={lineId}
                onChange={(e) => pick(pending.find((p) => p.line_id === e.target.value))}
              >
                <option value="">{t('fa.register.choosePurchase')}</option>
                {pending.map((p) => (
                  <option key={p.line_id} value={p.line_id}>
                    {p.number} · {formatDate(p.doc_date, era)} · {p.description} ·{' '}
                    {money(Number(p.cost))}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="fa-name">{t('fa.fields.name')}</Label>
            <Input
              id="fa-name"
              value={name}
              placeholder={t('fa.fields.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fa-cat">{t('fa.fields.category')}</Label>
            <select
              id="fa-cat"
              className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                const c = categories.find((x) => x.id === e.target.value)
                if (c && !years) setYears(String(c.default_life_months / 12))
              }}
            >
              <option value="">{t('fa.fields.chooseCategory')}</option>
              {categories
                .filter((c) => c.is_active)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({t('fa.fields.years', { n: c.default_life_months / 12 })})
                  </option>
                ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fa-date">{t('fa.fields.startDate')}</Label>
            <Input
              id="fa-date"
              type="date"
              value={date}
              disabled={source === 'document' && !!lineId}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fa-cost">{t('fa.fields.cost')}</Label>
            <Input
              id="fa-cost"
              inputMode="decimal"
              className="text-right"
              value={cost}
              disabled={source === 'document' && !!lineId}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fa-life">{t('fa.fields.lifeYears')}</Label>
            <Input
              id="fa-life"
              inputMode="decimal"
              className="text-right"
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fa-salvage">{t('fa.fields.salvage')}</Label>
            <Input
              id="fa-salvage"
              inputMode="decimal"
              className="text-right"
              placeholder="0.00"
              value={salvage}
              onChange={(e) => setSalvage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('fa.fields.salvageHint')}</p>
          </div>
          {source === 'opening' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="fa-oacc">{t('fa.fields.openingAccum')}</Label>
                <Input
                  id="fa-oacc"
                  inputMode="decimal"
                  className="text-right"
                  placeholder="0.00"
                  value={openingAccum}
                  onChange={(e) => setOpeningAccum(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fa-odate">{t('fa.fields.openingDate')}</Label>
                <Input
                  id="fa-odate"
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {plan.length > 0 && (
          <div className="rounded-xl bg-accent/60 px-4 py-3 text-sm">
            {t('fa.register.preview', {
              monthly: money((num(cost) - num(salvage)) / lifeMonths),
              first: money(plan[0].amount),
              firstMonth: monthLabel(plan[0].month, era, i18n.language),
              end: monthLabel(plan[plan.length - 1].month, era, i18n.language),
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t(`fa.register.posting.${source}`)}</p>
        {reg.error != null && (
          <Alert variant="destructive">
            <AlertDescription>{dbErrorMessage(t, reg.error)}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!ok || reg.isPending} onClick={submit}>
            {t('fa.register.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
