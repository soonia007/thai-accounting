import { useMutation } from '@tanstack/react-query'
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
import { supabase } from '@/lib/supabase'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: { documentId: string } | { paymentId: string }
  number: string | null
  onVoided: () => void
}

export function VoidDialog({ open, onOpenChange, target, number, onVoided }: Props) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const run = useMutation({
    mutationFn: async () => {
      const { error } =
        'documentId' in target
          ? await supabase.rpc('void_document', {
              p_document_id: target.documentId,
              p_reason: reason,
            })
          : await supabase.rpc('void_payment', { p_payment_id: target.paymentId, p_reason: reason })
      if (error) throw error
    },
    onSuccess: () => {
      onOpenChange(false)
      setReason('')
      onVoided()
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) run.reset()
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('docs.voidTitle', { number })}</DialogTitle>
          <DialogDescription>{t('docs.voidHelp')}</DialogDescription>
        </DialogHeader>
        {run.error && (
          <Alert variant="destructive">
            <AlertDescription>{dbErrorMessage(t, run.error)}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-2">
          <Label htmlFor="void-reason">{t('docs.voidReason')}</Label>
          <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || run.isPending}
            onClick={() => run.mutate()}
          >
            {t('docs.void')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
