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
  if (isOutdatedDatabase(e)) return t('dbErrors.DB_OUTDATED')
  return e.message || t('dbErrors.UNKNOWN')
}

/**
 * The app is newer than the database: a migration has not been applied yet (a function, table
 * or storage bucket the code uses does not exist). Fix: `npm run db:migrate`.
 */
export function isOutdatedDatabase(error: unknown): boolean {
  const e = (error ?? {}) as DbError
  return (
    e.code === 'PGRST202' || // function not in the schema cache
    e.code === 'PGRST205' || // table not in the schema cache
    e.code === '42883' || // undefined function
    e.code === '42P01' || // undefined table
    /bucket not found|could not find the (function|table)/i.test(e.message ?? '')
  )
}
