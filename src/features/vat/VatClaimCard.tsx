import { useMutation } from '@tanstack/react-query'
import { Pencil, ReceiptText } from 'lucide-react'
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
import { formatDate, type DateEra } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { claimMonthOf, monthLabel } from './month'

/**
 * D12: the vendor's tax invoice and the month its input VAT is claimed in, on a posted purchase
 * or payment. Editable after posting (no effect on the ledger) unless that PP.30 month is filed.
 */
export function VatClaimCard({
  target,
  taxInvoiceNo,
  taxInvoiceDate,
  claimMonth,
  fallbackNo,
  fallbackDate,
  era,
  canEdit,
  onSaved,
}: {
  target: { documentId: string } | { paymentId: string }
  taxInvoiceNo: string | null
  taxInvoiceDate: string | null
  claimMonth: string | null
  /** used when no tax invoice number was entered (the document's reference) */
  fallbackNo: string | null
  /** document / payment date */
  fallbackDate: string
  era: DateEra
  canEdit: boolean
  onSaved: () => void
}) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [no, setNo] = useState(taxInvoiceNo ?? '')
  const [date, setDate] = useState(taxInvoiceDate ?? '')
  const [month, setMonth] = useState(claimMonth ? claimMonth.slice(0, 7) : '')
  const effective = claimMonthOf(claimMonth, taxInvoiceDate ?? fallbackDate)

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('set_vat_claim', {
        p_document_id: 'documentId' in target ? target.documentId : (null as unknown as string),
        p_payment_id: 'paymentId' in target ? target.paymentId : (null as unknown as string),
        p_tax_invoice_no: no.trim() || (null as unknown as string),
        p_tax_invoice_date: date || (null as unknown as string),
        p_claim_month: month ? `${month}-01` : (null as unknown as string),
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
        <ReceiptText className="size-4 text-brand" />
        {t('vat.claim.title')}
      </span>
      <span>
        <span className="text-muted-foreground">{t('vat.claim.invoiceNo')}: </span>
        {taxInvoiceNo ?? fallbackNo ?? '—'}
      </span>
      <span>
        <span className="text-muted-foreground">{t('vat.claim.invoiceDate')}: </span>
        {formatDate(taxInvoiceDate ?? fallbackDate, era)}
      </span>
      <span>
        <span className="text-muted-foreground">{t('vat.claim.month')}: </span>
        {monthLabel(effective, era, i18n.language)}
      </span>
      {canEdit && (
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setOpen(true)}>
          <Pencil className="size-4" />
          {t('common.edit')}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('vat.claim.title')}</DialogTitle>
            <DialogDescription>{t('vat.claim.hint')}</DialogDescription>
          </DialogHeader>
          {save.error && (
            <Alert variant="destructive">
              <AlertDescription>{dbErrorMessage(t, save.error)}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="vc-no">{t('vat.claim.invoiceNo')}</Label>
              <Input
                id="vc-no"
                value={no}
                placeholder={fallbackNo ?? ''}
                onChange={(e) => setNo(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vc-date">{t('vat.claim.invoiceDate')}</Label>
              <Input
                id="vc-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vc-month">{t('vat.claim.month')}</Label>
              <Input
                id="vc-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
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
