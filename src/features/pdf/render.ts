import { createElement } from 'react'
import type { PrintData } from './print-data'
import { documentTitle } from './print-data'

/** Build the PDF in the browser (spec §1). react-pdf is loaded on demand to keep the app bundle small. */
export async function renderPdf(data: PrintData, copy: boolean): Promise<Blob> {
  const [{ pdf }, { DocumentPdf }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./DocumentPdf'),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pdf(createElement(DocumentPdf, { data, copy }) as any).toBlob()
}

export function pdfFileName(data: PrintData, copy: boolean): string {
  const title = documentTitle(data).en.replace(/\W+/g, '-').toLowerCase()
  return `${data.document.number ?? title}${copy ? '-copy' : ''}.pdf`
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const shareUrl = (token: string) => `${window.location.origin}/share/${token}`
