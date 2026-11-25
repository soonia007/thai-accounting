import type { TFunction } from 'i18next'

interface AuthErrorLike {
  name?: string
  message?: string
  status?: number
  code?: string
}

/** Server unreachable (Supabase not started, wrong URL, offline) — not a wrong password. */
export function isNetworkError(error: unknown): boolean {
  const e = (error ?? {}) as AuthErrorLike
  return (
    e.name === 'AuthRetryableFetchError' ||
    /failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(
      e.message ?? '',
    )
  )
}

const KNOWN_CODES = [
  'user_already_exists',
  'weak_password',
  'email_address_invalid',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'signup_disabled',
  'email_not_confirmed',
] as const

/** Supabase Auth error → message in the user's language. */
export function authErrorMessage(t: TFunction, error: unknown, mode: 'signIn' | 'signUp'): string {
  const e = (error ?? {}) as AuthErrorLike
  if (isNetworkError(e)) return t('auth.errors.network')
  if (e.code && (KNOWN_CODES as readonly string[]).includes(e.code)) {
    return t(`auth.errors.${e.code}`)
  }
  if (e.code === 'invalid_credentials' || mode === 'signIn') return t('auth.errors.invalidLogin')
  return e.message || t('dbErrors.UNKNOWN')
}
