import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
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
import { formatMoney, todayBangkok } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { BalanceRow } from './model'
import { usePostAdjustment, type AdjustmentPayload } from './queries'

type Kind = AdjustmentPayload['kind']
interface Line {
  product_id: string
  value: string // opening/other: quantity · count: counted quantity · damage: quantity lost
  unit_cost: string
}
const num = (s: string) => Number(s.replace(/,/g, '').trim() || 0)

/**
 * One dialog for the four ways stock changes outside documents. The user always types what they
 * see (opening quantity, counted quantity, quantity damaged); the dialog works out the change.
 */
export function AdjustmentDialog({
  open,
  onClose,
  companyId,
  stock,
  initialKind,
}: {
  open: boolean
  onClose: () => void
  companyId: string
  stock: BalanceRow[]
  initialKind?: Kind
}) {
  const { t, i18n } = useTranslation()
  const [kind, setKind] = useState<Kind>(initialKind ?? 'count')
  const [date, setDate] = useState(todayBangkok())
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState<Line[]>([{ product_id: '', value: '', unit_cost: '' }])
  const post = usePostAdjustment(companyId)
  const onHand = (id: string) => Number(stock.find((s) => s.product_id === id)?.qty ?? 0)
  const change = (l: Line) =>
    kind === 'count'
      ? num(l.value) - onHand(l.product_id)
      : kind === 'damage'
        ? -num(l.value)
        : num(l.value)
  const needsCost = (l: Line) => kind === 'opening' || (change(l) > 0 && onHand(l.product_id) <= 0)
  const ready = lines.some((l) => l.product_id && l.value.trim() !== '' && change(l) !== 0)

  const close = () => {
    post.reset()
    setLines([{ product_id: '', value: '', unit_cost: '' }])
    setMemo('')
    onClose()
  }
  const submit = () =>
    post.mutate(
      {
        adj_date: date,
        kind,
        memo,
        lines: lines
          .filter((l) => l.product_id && change(l) !== 0)
          .map((l) => ({
            product_id: l.product_id,
            qty: change(l),
            unit_cost: l.unit_cost.trim() ? num(l.unit_cost) : null,
          })),
      },
      { onSuccess: close },
    )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('stock.adjust.title')}</DialogTitle>
          <DialogDescription>{t(`stock.adjust.kindInfo.${kind}`)}</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-4">
          {(['count', 'damage', 'opening', 'other'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                'cursor-pointer rounded-xl border p-3 text-left text-sm transition-colors hover:border-brand',
                kind === k && 'border-brand bg-accent ring-2 ring-finora-mint/40',
              )}
            >
              <span className="block font-medium">{t(`stock.adjust.kinds.${k}`)}</span>
              <span className="block text-xs text-muted-foreground">
                {t(`stock.adjust.kindShort.${k}`)}
              </span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="adj-date">{t('stock.adjust.date')}</Label>
            <Input
              id="adj-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adj-memo">{t('stock.adjust.memo')}</Label>
            <Input id="adj-memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((l, i) => {
            const c = l.product_id ? change(l) : 0
            return (
              <div
                key={i}
                className="grid gap-2 rounded-xl border p-2 sm:grid-cols-[minmax(0,3fr)_8rem_8rem_minmax(0,2fr)_2rem] sm:items-end"
              >
                <div className="grid gap-1">
                  <Label className="text-xs">{t('stock.adjust.product')}</Label>
                  <select
                    className="h-10 rounded-xl border bg-card pr-9 pl-3 text-sm"
                    value={l.product_id}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)),
                      )
                    }
                  >
                    <option value="">{t('stock.adjust.chooseProduct')}</option>
                    {stock.map((s) => (
                      <option key={s.product_id} value={s.product_id}>
                        {s.code} {s.name} ({t('stock.onHand')} {Number(s.qty)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">{t(`stock.adjust.valueLabel.${kind}`)}</Label>
                  <Input
                    inputMode="decimal"
                    className="text-right"
                    value={l.value}
                    onChange={(e) =>
                      setLines(lines.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">
                    {t('stock.adjust.unitCost')}
                    {!needsCost(l) && (
                      <span className="text-muted-foreground"> ({t('stock.adjust.optional')})</span>
                    )}
                  </Label>
                  <Input
                    inputMode="decimal"
                    className="text-right"
                    disabled={c < 0}
                    placeholder={c < 0 ? t('stock.adjust.auto') : '0.00'}
                    value={l.unit_cost}
                    onChange={(e) =>
                      setLines(
                        lines.map((x, j) => (j === i ? { ...x, unit_cost: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <p
                  className={cn(
                    'pb-2 text-sm font-medium',
                    c > 0
                      ? 'text-success-foreground'
                      : c < 0
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                  )}
                >
                  {l.product_id && l.value.trim() !== ''
                    ? c === 0
                      ? t('stock.adjust.noChange')
                      : `${c > 0 ? '+' : ''}${c} ${t('stock.adjust.units')}${
                          c > 0 && l.unit_cost.trim()
                            ? ` · ${formatMoney(c * num(l.unit_cost), i18n.language)}`
                            : ''
                        }`
                    : ''}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('lines.remove')}
                  disabled={lines.length === 1}
                  onClick={() => setLines(lines.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )
          })}
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setLines([...lines, { product_id: '', value: '', unit_cost: '' }])}
          >
            <Plus className="size-4" />
            {t('lines.add')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t(`stock.adjust.posting.${kind}`)}</p>
        {post.error != null && (
          <Alert variant="destructive">
            <AlertDescription>{dbErrorMessage(t, post.error)}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button disabled={!ready || post.isPending} onClick={submit}>
            {t('stock.adjust.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
