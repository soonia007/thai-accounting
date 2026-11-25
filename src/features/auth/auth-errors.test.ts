import type { TFunction } from 'i18next'
import { authErrorMessage, isNetworkError } from './auth-errors'

const t = ((key: string) => key) as unknown as TFunction

describe('authErrorMessage', () => {
  it('reports an unreachable server instead of the raw "Failed to fetch"', () => {
    const err = { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 }
    expect(authErrorMessage(t, err, 'signUp')).toBe('auth.errors.network')
    // sign-in must not claim the password is wrong when the server is down
    expect(authErrorMessage(t, err, 'signIn')).toBe('auth.errors.network')
  })
  it('recognises browser-specific network messages', () => {
    expect(isNetworkError({ message: 'NetworkError when attempting to fetch resource.' })).toBe(
      true,
    )
    expect(isNetworkError({ message: 'Load failed' })).toBe(true)
    expect(isNetworkError({ message: 'Invalid login credentials' })).toBe(false)
  })
  it('translates known Supabase Auth codes', () => {
    expect(authErrorMessage(t, { code: 'user_already_exists', message: 'x' }, 'signUp')).toBe(
      'auth.errors.user_already_exists',
    )
    expect(authErrorMessage(t, { code: 'invalid_credentials', message: 'x' }, 'signIn')).toBe(
      'auth.errors.invalidLogin',
    )
  })
})
