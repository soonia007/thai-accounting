import { Plus, Trash2 } from 'lucide-react'
import {
  useFieldArray,
  useWatch,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WhtIncomeType } from '@/features/wht/queries'
import { formatMoney } from '@/lib/format'
import type { LineAmounts } from '@/lib/money/calc'
import { emptyLine, type DocForm } from './payload'
import type { Product } from './queries'

interface Props {
  control: Control<DocForm>
  register: UseFormRegister<DocForm>
  setValue: UseFormSetValue<DocForm>
  products: Product[]
  isSale: boolean
  vatRegistered: boolean
  lineAmounts: LineAmounts[] | undefined
  /** Purchases: WHT income types (D6); omitted on sales */
  incomeTypes?: WhtIncomeType[]
}

const WHT_RATES = ['0', '1', '1.5', '2', '3', '5', '10']

export function LinesEditor({
  control,
  register,
  setValue,
  products,
  isSale,
  vatRegistered,
  lineAmounts,
  incomeTypes,
}: Props) {
  const { t, i18n } = useTranslation()
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = useWatch({ control, name: 'lines' })

  const pickProduct = (index: number, productId: string) => {
    setValue(`lines.${index}.product_id`, productId)
    const p = products.find((x) => x.id === productId)
    if (!p) return
    setValue(`lines.${index}.description`, p.name)
    setValue(`lines.${index}.item_kind`, p.kind)
    setValue(`lines.${index}.vat_type`, p.vat_type)
    const price = isSale ? p.sale_price : p.purchase_price
    if (price !== null) setValue(`lines.${index}.unit_price`, String(Number(price)))
    if (!isSale && p.wht_income_type) pickIncomeType(index, p.wht_income_type)
  }

  const pickIncomeType = (index: number, code: string) => {
    setValue(`lines.${index}.wht_income_type`, code)
    const type = incomeTypes?.find((x) => x.code === code)
    if (!code) setValue(`lines.${index}.wht_rate`, '0')
    else if (type?.default_rate) setValue(`lines.${index}.wht_rate`, String(type.default_rate))
  }
  const incomeTypeLabel = (x: WhtIncomeType) =>
    `${i18n.language === 'en' ? x.name_en : x.name_th} ${x.section}`

  return (
    // Container query: the form column is narrow when the preview panel is open
    <div className="@container flex flex-col gap-2">
      <div className="hidden grid-cols-[minmax(0,3fr)_5rem_7rem_6rem_5rem_7rem_2rem] gap-2 px-1 text-xs text-muted-foreground @3xl:grid">
        <span>{t('lines.item')}</span>
        <span className="text-right">{t('lines.qty')}</span>
        <span className="text-right">{t('lines.price')}</span>
        <span className="text-right">{t('lines.discount')}</span>
        <span className="text-right">{t('lines.wht')}</span>
        <span className="text-right">{t('lines.amount')}</span>
        <span />
      </div>
      {fields.map((field, i) => {
        const line = lines?.[i]
        const amount = lineAmounts?.[i]
        return (
          <div
            key={field.id}
            className="grid grid-cols-2 gap-2 rounded-lg border p-2 @3xl:grid-cols-[minmax(0,3fr)_5rem_7rem_6rem_5rem_7rem_2rem] @3xl:items-start @3xl:rounded-none @3xl:border-0 @3xl:border-b @3xl:p-1"
          >
            <div className="col-span-2 flex flex-col gap-1 @3xl:col-span-1">
              <select
                aria-label={t('lines.product')}
                className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm shadow-xs"
                value={line?.product_id ?? ''}
                onChange={(e) => pickProduct(i, e.target.value)}
              >
                <option value="">{t('lines.noProduct')}</option>
                {products
                  .filter((p) => p.is_active || p.id === line?.product_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} {p.name}
                    </option>
                  ))}
              </select>
              <Input
                aria-label={t('lines.description')}
                placeholder={t('lines.description')}
                {...register(`lines.${i}.description`)}
              />
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {(['service', 'product'] as const).map((k) => (
                  <label key={k} className="flex items-center gap-1">
                    <input type="radio" value={k} {...register(`lines.${i}.item_kind`)} />
                    {t(`products.kinds.${k}`)}
                  </label>
                ))}
                {incomeTypes && (
                  <select
                    aria-label={t('wht.incomeType')}
                    className="h-7 max-w-60 rounded-lg border bg-card [background-position:right_0.4rem_center] py-0 pr-7 pl-2 text-xs"
                    value={line?.wht_income_type ?? ''}
                    onChange={(e) => pickIncomeType(i, e.target.value)}
                  >
                    <option value="">{t('wht.noWithholding')}</option>
                    {incomeTypes.map((x) => (
                      <option key={x.code} value={x.code}>
                        {incomeTypeLabel(x)}
                      </option>
                    ))}
                  </select>
                )}
                {vatRegistered && (
                  <select
                    aria-label={t('products.vatType')}
                    className="h-7 rounded-lg border bg-card [background-position:right_0.4rem_center] py-0 pr-7 pl-2 text-xs"
                    {...register(`lines.${i}.vat_type`)}
                  >
                    {(['standard', 'zero', 'exempt'] as const).map((v) => (
                      <option key={v} value={v}>
                        {t(`lines.vat.${v}`)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground @3xl:block">
              <span className="@3xl:sr-only">{t('lines.qty')}</span>
              <Input inputMode="decimal" className="text-right" {...register(`lines.${i}.qty`)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground @3xl:block">
              <span className="@3xl:sr-only">{t('lines.price')}</span>
              <Input
                inputMode="decimal"
                className="text-right"
                placeholder="0.00"
                {...register(`lines.${i}.unit_price`)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground @3xl:block">
              <span className="@3xl:sr-only">{t('lines.discount')}</span>
              <Input
                inputMode="decimal"
                className="text-right"
                placeholder="0.00"
                {...register(`lines.${i}.discount`)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground @3xl:block">
              <span className="@3xl:sr-only">{t('lines.wht')}</span>
              <select
                className="h-10 w-full rounded-xl border bg-card pr-8 pl-2 text-right text-sm text-foreground shadow-xs"
                {...register(`lines.${i}.wht_rate`)}
              >
                {WHT_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r === '0' ? '—' : `${r}%`}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-end text-sm tabular-nums @3xl:h-9">
              <span className="mr-auto text-xs text-muted-foreground @3xl:hidden">
                {t('lines.amount')}
              </span>
              {amount ? formatMoney(amount.base + amount.vat, i18n.language) : '—'}
            </div>
            <div className="flex justify-end @3xl:h-9 @3xl:items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('lines.remove')}
                disabled={fields.length === 1}
                onClick={() => remove(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => append(emptyLine())}
      >
        <Plus className="size-4" />
        {t('lines.add')}
      </Button>
    </div>
  )
}
