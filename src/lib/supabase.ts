import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { normalizeSupabaseUrl } from './supabase-url'

const url = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * Typed Supabase client. When env vars are missing (e.g. unit tests) we still create a client
 * pointing at a dummy URL so imports don't crash; network calls will simply fail.
 */
export const supabase = createClient<Database>(
  url || 'http://localhost:54321',
  anonKey || 'missing-anon-key',
)

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

export type MemberRole = Enums<'member_role'>
export type BusinessType = Enums<'business_type'>
