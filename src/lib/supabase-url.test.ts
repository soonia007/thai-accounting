import { describe, expect, it } from 'vitest'
import { normalizeSupabaseUrl } from './supabase-url'

describe('normalizeSupabaseUrl', () => {
  it('keeps a correct base URL', () => {
    expect(normalizeSupabaseUrl('https://abcd.supabase.co')).toBe('https://abcd.supabase.co')
    expect(normalizeSupabaseUrl('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321')
  })
  it('strips API paths, trailing slashes, spaces and quotes', () => {
    expect(normalizeSupabaseUrl('https://abcd.supabase.co/rest/v1/')).toBe(
      'https://abcd.supabase.co',
    )
    expect(normalizeSupabaseUrl(' https://abcd.supabase.co/auth/v1 ')).toBe(
      'https://abcd.supabase.co',
    )
    expect(normalizeSupabaseUrl('"https://abcd.supabase.co/"')).toBe('https://abcd.supabase.co')
  })
  it('leaves an empty value empty', () => {
    expect(normalizeSupabaseUrl(undefined)).toBeUndefined()
    expect(normalizeSupabaseUrl('')).toBe('')
  })
})
