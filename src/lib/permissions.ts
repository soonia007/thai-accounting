import type { MemberRole } from './supabase'

/** Mirrors the RLS policies in supabase/migrations — the DB is the source of truth. */

/** Contacts and products: day-to-day data entry. */
export const canEditMasterData = (role: MemberRole | undefined) =>
  role === 'owner' || role === 'admin' || role === 'accountant' || role === 'staff'

export const canDeleteMasterData = (role: MemberRole | undefined) =>
  role === 'owner' || role === 'admin' || role === 'accountant'

/** Bank accounts and the chart of accounts. */
export const canEditFinanceSetup = (role: MemberRole | undefined) =>
  role === 'owner' || role === 'admin' || role === 'accountant'
