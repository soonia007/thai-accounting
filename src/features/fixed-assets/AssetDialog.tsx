import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
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
import { useCompany } from '@/features/company/CompanyProvider'
import { useContacts, useMoneyAccounts } from '@/features/documents/queries'
import { monthLabel } from '@/features/vat/month'
import { formatDate, formatMoney, todayBangkok } from '@/lib/format'
import { cn } from '@/lib/utils'
import { schedule, type AssetRow } from './model'
import { useDispose, useDisposalPreview } from './queries'

/** Asset detail: key figures, the depreciation plan and (for active assets) the disposal form. */
export function AssetDialog({
  asset,
  onClose,
  canEdit,
}: {
  asset: AssetRow | null
  onClose: () => void
  canEdit: boolean
}) {
  const { t, i18n } = useTranslation()
  const { current } = useCompany()
  const co = current!
  const era = co.date_era
  const money = (v: number) => formatMoney(v, i18n.language)
  const [mode, setMode] = useState<'detail' | 'dispose'>('detail')
  const [date, setDate] = useState(todayBangkok())
  const [proceeds, setProceeds] = useState('')
  const [contactId, setContactId] = useState('')
  const { data: money_ = [] } = useMoneyAccounts(co.id)
  const [accountId, setAccountId] = useState('')
  const { data: contacts = [] } = useContacts(co.id)
  const p = Number(proceeds.replace(/,/g, '') || 0)
  const preview = useDisposalPreview(mode === 'dispose' ? (asset?.id ?? null) : null, date, p)
  const dispose = useDispose(co.id)
  const plan = asset
    ? schedule({ ...asset, cost: Number(asset.cost), salvage: Number(asset.salvage) })
    : []

  const close = () => {
    setMode('detail')
    setProceeds('')
    dispose.reset()
    onClose()
  }
  if (!asset) return null
  const nbv = Number(asset.cost) - Number(asset.accum)

  return (
    <Dialog open={!!asset} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <span className="font-mono text-base text-muted-foreground">{asset.code}</span>{' '}
            {asset.name}
          </DialogTitle>
          <DialogDescription>
            {asset.category} · {t('fa.fields.startDate')} {formatDate(asset.acquired_on, era)} ·{' '}
            {t('fa.fields.years', { n: asset.life_months / 12 })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            [t('fa.fields.cost'), money(Number(asset.cost))],
            [t('fa.monthly'), money(Number(asset.monthly))],
            [t('fa.accum'), money(Number(asset.accum))],
            [t('fa.nbv'), asset.status === 'disposed' ? '—' : money(nbv)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border p-3">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="font-semibold tabular-nums">{v}</div>
            </div>
          ))}
        </div>

        {mode === 'detail' ? (
          <>
            {asset.status === 'disposed' && (
              <Alert>
                <AlertDescription>
                  {t('fa.disposedOn', {
                    date: formatDate(asset.disposed_on!, era),
                    amount: money(Number(asset.disposal_proceeds ?? 0)),
                  })}
                  {asset.disposal_document_id && (
                    <>
                      {' '}
                      <Link className="underline" to={`/sales/${asset.disposal_document_id}`}>
                        {t('fa.viewSale')}
                      </Link>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className="max-h-72 overflow-y-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t('fa.plan.month')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('fa.plan.amount')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('fa.accum')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('fa.nbv')}</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((r) => (
                    <tr
                      key={r.month}
                      className={cn(
                        'border-t',
                        r.accum <= Number(asset.booked) && 'text-muted-foreground',
                      )}
                    >
                      <td className="px-3 py-1.5">{monthLabel(r.month, era, i18n.language)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{money(r.amount)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{money(r.accum)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{money(r.nbv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{t('fa.plan.note')}</p>
            <DialogFooter>
              {asset.source_document_id && (
                <Button variant="ghost" asChild>
                  <Link to={`/purchases/${asset.source_document_id}`}>{t('fa.viewPurchase')}</Link>
                </Button>
              )}
              {canEdit && asset.status === 'active' && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setMode('dispose')}
                >
                  {t('fa.dispose.button')}
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t('fa.dispose.info')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="d-date">{t('fa.dispose.date')}</Label>
                <Input
                  id="d-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="d-proceeds">{t('fa.dispose.proceeds')}</Label>
                <Input
                  id="d-proceeds"
                  inputMode="decimal"
                  className="text-right"
                  placeholder="0.00"
                  value={proceeds}
                  onChange={(e) => setProceeds(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t('fa.dispose.proceedsHint')}</p>
              </div>
              {p > 0 && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="d-buyer">{t('fa.dispose.buyer')}</Label>
                    <select
                      id="d-buyer"
                      className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm"
                      value={contactId}
                      onChange={(e) => setContactId(e.target.value)}
                    >
                      <option value="">{t('fa.dispose.noBuyer')}</option>
                      {contacts
                        .filter((c) => c.is_active && c.contact_type !== 'vendor')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="d-acc">{t('fa.dispose.receivedInto')}</Label>
                    <select
                      id="d-acc"
                      className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm"
                      value={accountId || money_[0]?.id || ''}
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      {money_.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} {i18n.language === 'en' ? a.name_en || a.name_th : a.name_th}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            {preview.data && (
              <div className="grid gap-1 rounded-xl bg-muted/60 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span>{t('fa.dispose.topUp')}</span>
                  <span className="tabular-nums">{money(Number(preview.data.top_up))}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('fa.nbv')}</span>
                  <span className="tabular-nums">{money(Number(preview.data.nbv))}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('fa.dispose.proceeds')}</span>
                  <span className="tabular-nums">{money(p)}</span>
                </div>
                <div
                  className={cn(
                    'flex justify-between font-semibold',
                    Number(preview.data.gain) >= 0 ? 'text-success-foreground' : 'text-destructive',
                  )}
                >
                  <span>
                    {Number(preview.data.gain) >= 0 ? t('fa.dispose.gain') : t('fa.dispose.loss')}
                  </span>
                  <span className="tabular-nums">{money(Math.abs(Number(preview.data.gain)))}</span>
                </div>
                {p > 0 && co.vat_registered && (
                  <p className="text-xs text-muted-foreground">
                    {t('fa.dispose.vatNote', {
                      vat: money(Math.round(p * Number(co.vat_rate)) / 100),
                    })}
                  </p>
                )}
              </div>
            )}
            {dispose.error != null && (
              <Alert variant="destructive">
                <AlertDescription>{dbErrorMessage(t, dispose.error)}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setMode('detail')}>
                {t('common.back')}
              </Button>
              <Button
                variant="destructive"
                disabled={dispose.isPending || (p > 0 && !(accountId || money_[0]?.id))}
                onClick={() =>
                  dispose.mutate(
                    {
                      asset_id: asset.id,
                      disposed_on: date,
                      proceeds: p,
                      contact_id: contactId || null,
                      payment_account_id: p > 0 ? accountId || money_[0]?.id : null,
                    },
                    { onSuccess: close },
                  )
                }
              >
                {p > 0 ? t('fa.dispose.submitSale') : t('fa.dispose.submitWriteOff')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
