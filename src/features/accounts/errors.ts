import type { TFunction } from 'i18next'

interface DbError {
  code?: string
  message?: string
}

/**
 * Translate errors raised by the DB rules (see migrations, errcode P0001 with UPPER_SNAKE message)
 * and common Postgres codes into a user-facing message.
 */
export function dbErrorMessage(t: TFunction, error: unknown): string {
  const e = (error ?? {}) as DbError
  if (e.code === 'P0001' && e.message && /^[A-Z_]+$/.test(e.message)) {
    return t(`dbErrors.${e.message}`, { defaultValue: t('dbErrors.UNKNOWN') })
  }
  if (e.code === '23505') return t('dbErrors.DUPLICATE')
  if (e.code === '23503') return t('dbErrors.IN_USE')
  if (e.code === '42501') return t('dbErrors.PERMISSION')
  return e.message || t('dbErrors.UNKNOWN')
}
