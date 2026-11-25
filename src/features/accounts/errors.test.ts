import type { TFunction } from 'i18next'
import { dbErrorMessage, isOutdatedDatabase } from './errors'

const t = ((key: string) => key) as unknown as TFunction

describe('dbErrorMessage', () => {
  it('explains a missing migration instead of the raw PostgREST message', () => {
    const e = {
      code: 'PGRST202',
      message:
        'Could not find the function public.save_manual_journal(p_payload) in the schema cache',
    }
    expect(dbErrorMessage(t, e)).toBe('dbErrors.DB_OUTDATED')
  })
  it('treats a missing storage bucket as an outdated database', () => {
    expect(isOutdatedDatabase({ message: 'Bucket not found' })).toBe(true)
  })
  it('keeps business-rule errors as they are', () => {
    expect(dbErrorMessage(t, { code: 'P0001', message: 'JOURNAL_NOT_BALANCED' })).toBe(
      'dbErrors.JOURNAL_NOT_BALANCED',
    )
    expect(isOutdatedDatabase({ code: 'P0001', message: 'JOURNAL_NOT_BALANCED' })).toBe(false)
  })
})
