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
import { useAccounts } from '@/features/accounts/queries'
import { formatDate, formatMoney, type DateEra } from '@/lib/format'
import { useAdjustment, type StatementLine } from './queries'

/** D15: a statement line with nothing in the books (bank charges, interest …) → posted JV. */
export function AdjustmentDialog({
  line,
  onClose,
  companyId,
  bankId,
  bankLedgerId,
  era,
}: {
  line: StatementLine | null
  onClose: () => void
  companyId: string
  bankId: string
  bankLedgerId: string
  era: DateEra
}) {
  const { t, i18n } = useTranslation()
  const { data: accounts = [] } = useAccounts(companyId)
  const adj = useAdjustment(bankId)
  const isOut = (line?.amount ?? 0) < 0
  const options = useMemo(
    () =>
      accounts.filter(
        (a) =>
          !a.is_group &&
          a.is_active &&
          a.id !== bankLedgerId &&
          (isOut
            ? a.type === 'expense' || a.type === 'asset' || a.type === 'liability'
            : a.type !== 'expense'),
      ),
    [accounts, bankLedgerId, isOut],
  )
  // bank charges 5260 / interest income 4910 (template codes) as the first guess
  const guess = options.find((a) => a.code === (isOut ? '5260' : '4910'))?.id ?? ''
  const [accountId, setAccountId] = useState('')
  const [memo, setMemo] = useState('')
  const chosen = accountId || guess

  return (
    <Dialog
      open={!!line}
      onOpenChange={(o) => {
        if (!o) {
          adj.reset()
          setAccountId('')
          setMemo('')
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('bankRecon.adjust.title')}</DialogTitle>
          <DialogDescription>{t('bankRecon.adjust.info')}</DialogDescription>
        </DialogHeader>
        {line && (
          <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span>{formatDate(line.txn_date, era)}</span>
              <span
                className={
                  isOut ? 'font-semibold text-destructive' : 'font-semibold text-success-foreground'
                }
              >
                {formatMoney(line.amount, i18n.language)}
              </span>
            </div>
            <div className="text-muted-foreground">{line.description}</div>
          </div>
        )}
        {adj.error != null && (
          <Alert variant="destructive">
            <AlertDescription>{dbErrorMessage(t, adj.error)}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="adj-acc">
              {isOut ? t('bankRecon.adjust.accountOut') : t('bankRecon.adjust.accountIn')}
            </Label>
            <select
              id="adj-acc"
              className="h-10 rounded-xl border bg-card pr-9 pl-3.5 text-sm"
              value={chosen}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">{t('bankRecon.adjust.choose')}</option>
              {options.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} {i18n.language === 'en' ? a.name_en || a.name_th : a.name_th}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adj-memo">{t('bankRecon.adjust.memo')}</Label>
            <Input
              id="adj-memo"
              value={memo}
              placeholder={line?.description}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {isOut ? t('bankRecon.adjust.previewOut') : t('bankRecon.adjust.previewIn')}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!chosen || adj.isPending || !line}
            onClick={() =>
              line &&
              adj.mutate(
                { statementLineId: line.id, accountId: chosen, memo },
                {
                  onSuccess: () => {
                    setAccountId('')
                    setMemo('')
                    onClose()
                  },
                },
              )
            }
          >
            {t('bankRecon.adjust.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
