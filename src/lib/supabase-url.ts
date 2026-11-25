/**
 * The project URL must be the base (https://<ref>.supabase.co). People often paste the API
 * endpoint instead (…/rest/v1/ from "Project API"), which makes every auth call fail with
 * "Invalid path specified in request URL". Accept those forms and strip them back to the base.
 */
export function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw
  let u = raw.trim().replace(/^["']|["']$/g, '')
  u = u.replace(/\/+$/, '')
  u = u.replace(/\/(rest|auth|storage|functions|realtime)\/v1(\/.*)?$/i, '')
  return u.replace(/\/+$/, '')
}
