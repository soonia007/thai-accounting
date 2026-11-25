import { createElement } from 'react'
import { companyLogoUrl } from '@/features/company/logo'
import { downloadBlob } from '@/features/pdf/render'
import { supabase } from '@/lib/supabase'
import type { WhtCertificateData } from './types'

/** Fetch print data and download the 50 ทวิ PDF (react-pdf loaded on demand). */
export async function downloadWhtCertificate(certificateId: string): Promise<void> {
  const { data, error } = await supabase.rpc('print_wht_certificate', {
    p_certificate_id: certificateId,
  })
  if (error) throw error
  if (!data) throw new Error('NOT_FOUND')
  const cert = data as unknown as WhtCertificateData
  const [{ pdf }, { WhtCertificatePdf }, { loadLogo }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./WhtCertificatePdf'),
    import('@/features/pdf/load-logo'),
  ])
  const logo = await loadLogo(companyLogoUrl(cert.payer.logo_path))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(createElement(WhtCertificatePdf, { data: cert, logo }) as any).toBlob()
  downloadBlob(blob, `${cert.number}.pdf`)
}
