/** Must match the bucket limit in supabase/migrations/20261125060100_m6_purchases.sql */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

/**
 * Storage path for a new attachment: "<company_id>/<uuid>-<safe name>".
 * The first folder is the company id — Storage RLS and the attachments table check it.
 */
export function attachmentPath(
  companyId: string,
  fileName: string,
  id: string = crypto.randomUUID(),
) {
  fileName = fileName.split(/[/\\]/).pop() ?? ''
  const dot = fileName.lastIndexOf('.')
  const ext =
    dot > 0
      ? fileName
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : ''
  const stem = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${companyId}/${id}-${stem || 'file'}${ext ? `.${ext}` : ''}`
}
