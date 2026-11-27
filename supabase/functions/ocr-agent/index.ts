// M17: endpoint for the OCR connector (tools/ocr-connector). Auth: header `x-finora-key` (an agent
// key made in the app: Settings → OCR connection). Routes (all POST):
//   /ping                         → { company, company_id }
//   /claim   { limit? }           → { jobs: [{ id, file_name, mime_type, download_url }] }  files uploaded in the app
//   /upload  multipart `file`     → { id, duplicate, status }   a file the connector found (watched folder)
//   /result  { job_id, raw?, document?, error? }  → { id, status }   `document` must match ocr-document.v1
// No npm dependencies: plain fetch to PostgREST/Storage with the service role key.
import schema from './ocr-document.v1.json' with { type: 'json' }
import { validate } from './validate.ts'

const URL_ = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const MAX_BYTES = 20 * 1024 * 1024
const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
}
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-finora-key, authorization, apikey',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
const fail = (status: number, code: string, detail?: unknown) =>
  json({ error: code, detail }, status)
const svc = { apikey: SERVICE, authorization: `Bearer ${SERVICE}` }

class DbError extends Error {}
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...svc, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  const body = await r.json().catch(() => null)
  if (!r.ok) throw new DbError(body?.message ?? `rpc ${fn} failed`)
  return body as T
}
async function sha256(bytes: Uint8Array) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('')
}
const enc = (path: string) => path.split('/').map(encodeURIComponent).join('/')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED')
  const route = new URL(req.url).pathname.split('/').filter(Boolean).pop()

  let agent: { key_id: string; company_id: string; company: string }
  try {
    agent = await rpc('ocr_agent_auth', { p_key: req.headers.get('x-finora-key') ?? '' })
  } catch {
    return fail(401, 'OCR_KEY_INVALID')
  }

  try {
    if (route === 'ping') return json({ company: agent.company, company_id: agent.company_id })

    if (route === 'claim') {
      const body = await req.json().catch(() => ({}))
      const jobs = await rpc<
        { id: string; storage_path: string; file_name: string; mime_type: string }[]
      >('ocr_agent_claim', { p_key_id: agent.key_id, p_limit: body?.limit ?? 5 })
      const out = await Promise.all(
        jobs.map(async (j) => {
          const r = await fetch(`${URL_}/storage/v1/object/sign/ocr-files/${enc(j.storage_path)}`, {
            method: 'POST',
            headers: { ...svc, 'content-type': 'application/json' },
            body: JSON.stringify({ expiresIn: 600 }),
          })
          const s = await r.json().catch(() => ({}))
          const signed = s.signedURL ?? s.signedUrl
          return {
            id: j.id,
            file_name: j.file_name,
            mime_type: j.mime_type,
            // a path: the connector joins it with the address it already uses (works locally and online)
            download_url: signed ? `/storage/v1${signed}` : null,
          }
        }),
      )
      return json({ jobs: out })
    }

    if (route === 'upload') {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File)) return fail(400, 'FILE_MISSING')
      if (file.size > MAX_BYTES) return fail(413, 'FILE_TOO_LARGE')
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const mime = MIME[ext]
      if (!mime) return fail(415, 'FILE_TYPE_NOT_SUPPORTED')
      const bytes = new Uint8Array(await file.arrayBuffer())
      const hash = await sha256(bytes)
      const path = `${agent.company_id}/${crypto.randomUUID()}.${ext}`
      const up = await fetch(`${URL_}/storage/v1/object/ocr-files/${enc(path)}`, {
        method: 'POST',
        headers: { ...svc, 'content-type': mime },
        body: bytes,
      })
      if (!up.ok) return fail(500, 'STORAGE_ERROR', await up.text())
      const res = await rpc<{ duplicate: boolean }>('ocr_agent_create_job', {
        p_key_id: agent.key_id,
        p_storage_path: path,
        p_file_name: file.name.slice(0, 255),
        p_mime: mime,
        p_size: file.size,
        p_sha256: hash,
      })
      if (res.duplicate) {
        await fetch(`${URL_}/storage/v1/object/ocr-files`, {
          method: 'DELETE',
          headers: { ...svc, 'content-type': 'application/json' },
          body: JSON.stringify({ prefixes: [path] }),
        })
      }
      return json(res)
    }

    if (route === 'result') {
      const body = await req.json().catch(() => null)
      if (typeof body?.job_id !== 'string') return fail(400, 'JOB_ID_MISSING')
      if (!body.error) {
        const issues = validate(schema as Record<string, unknown>, body.document)
        if (issues.length) return fail(422, 'OCR_RESULT_INVALID', issues)
      }
      const res = await rpc('ocr_agent_submit', {
        p_key_id: agent.key_id,
        p_job_id: body.job_id,
        p_raw: body.raw ?? null,
        p_result: body.error ? null : body.document,
        p_error: body.error ? String(body.error) : null,
      })
      return json(res)
    }
    return fail(404, 'NOT_FOUND')
  } catch (e) {
    if (e instanceof DbError) return fail(400, e.message)
    return fail(500, 'INTERNAL', String(e))
  }
})
