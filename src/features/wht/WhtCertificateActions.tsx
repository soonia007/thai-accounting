import { useMutation, useQuery } from '@tanstack/react-query'
import { FileBadge } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { downloadWhtCertificate } from './render'

/** "50 ทวิ" button(s) for a posted payment or cash purchase that withheld tax (D7). */
export function WhtCertificateActions({
  paymentId,
  documentId,
}: {
  paymentId?: string
  documentId?: string
}) {
  const { t } = useTranslation()
  const certs = useQuery({
    queryKey: ['wht-certificates', paymentId ?? documentId],
    queryFn: async () => {
      let q = supabase.from('wht_certificates').select('id, number, voided_at')
      q = paymentId ? q.eq('payment_id', paymentId) : q.eq('document_id', documentId!)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
  const download = useMutation({ mutationFn: downloadWhtCertificate })
  return (
    <>
      {(certs.data ?? []).map((c) => (
        <Button
          key={c.id}
          variant="outline"
          size="sm"
          disabled={download.isPending}
          onClick={() => download.mutate(c.id)}
        >
          <FileBadge className="size-4" />
          {t('wht.certificateButton', { number: c.number })}
        </Button>
      ))}
    </>
  )
}
