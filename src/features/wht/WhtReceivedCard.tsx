import { useMutation } from '@tanstack/react-query'
import { FileInput, Pencil } from 'lucide-react'
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
import { formatDate, formatMoney, type DateEra } from '@/lib/format'
import { supabase } from '@/lib/supabase'

/** D14: the customer's 50 ทวิ for tax withheld from us, on a posted receipt or cash sale. */
export function WhtReceivedCard({
  target,
  amount,
  certNo,
  certDate,
  era,
  canEdit,
  onSaved,
}: {
  target: { documentId: string } | { paymentId: string }
  amount: number
  certNo: string | null
  certDate: string | null
  era: DateEra
  canEdit: boolean
  onSaved: () => void
}) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [no, setNo] = useState(certNo ?? '')
  const [date, setDate] = useState(certDate ?? '')
  const save = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)('set_received_wht_cert', {
        p_document_id: 'documentId' in target ? target.documentId : null,
        p_payment_id: 'paymentId' in target ? target.paymentId : null,
        p_cert_no: no.trim() || null,
        p_cert_date: date || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setOpen(false)
      onSaved()
    },
  })
  return (
    <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm shadow-card">
      <span className="flex items-center gap-2 font-medium">
        <FileInput className="size-4 text-brand" />
        {t('whtReceived.title')}
      </span>
      <span>
        <span className="text-muted-foreground">{t('whtReceived.amount')}: </span>
        {formatMoney(amount, i18n.language)}
      </span>
      {certNo ? (
        <span>
          <span className="text-muted-foreground">{t('whtReceived.certNo')}: </span>
          {certNo}
          {certDate && ` · ${formatDate(certDate, era)}`}
        </span>
      ) : (
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning-foreground">
          {t('whtReceived.missing')}
        </span>
      )}
      {canEdit && (
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setOpen(true)}>
          <Pencil className="size-4" />
          {t('common.edit')}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('whtReceived.title')}</DialogTitle>
            <DialogDescription>{t('whtReceived.hint')}</DialogDescription>
          </DialogHeader>
          {save.error != null && (
            <Alert variant="destructive">
              <AlertDescription>{dbErrorMessage(t, save.error)}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="wr-no">{t('whtReceived.certNo')}</Label>
              <Input id="wr-no" value={no} onChange={(e) => setNo(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wr-date">{t('whtReceived.certDate')}</Label>
              <Input
                id="wr-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
