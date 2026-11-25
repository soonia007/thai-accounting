/**
 * Fetch the company logo as a data URL for embedding. A missing or unreachable logo must never
 * stop a document from being produced, so failures return null (the company name is shown).
 */
export async function loadLogo(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    if (!/^image\/(png|jpe?g)$/.test(blob.type)) return null
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
