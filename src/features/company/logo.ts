import { supabase } from '@/lib/supabase'

export const LOGO_BUCKET = 'company-logos'
/** Must match the bucket limit in supabase/migrations/20261125080000_company_logo.sql */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024

/** Public URL of a stored logo (logos are printed on documents, so the bucket is public). */
export function companyLogoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Scale a box down to fit max width/height, keeping the aspect ratio (never scales up). */
export function fitWithin(w: number, h: number, maxW: number, maxH: number) {
  const k = Math.min(1, maxW / w, maxH / h)
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

/**
 * Any image the browser can open (PNG, JPEG, WebP, SVG…) → PNG ≤ 800×400 with transparency kept.
 * PDFs only embed PNG/JPEG, and a small file keeps documents light.
 */
export async function normalizeLogo(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('LOGO_NOT_IMAGE')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('LOGO_NOT_IMAGE'))
      i.src = url
    })
    const { width, height } = fitWithin(img.naturalWidth || 400, img.naturalHeight || 400, 800, 400)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
    if (!blob) throw new Error('LOGO_NOT_IMAGE')
    if (blob.size > MAX_LOGO_BYTES) throw new Error('LOGO_TOO_LARGE')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
