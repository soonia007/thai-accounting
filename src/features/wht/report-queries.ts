import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { IssuedCert, PndLine, ReceivedWht } from './report-model'

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  // jsonb results: cast at this one boundary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, args)
  if (error) throw error
  return data as T
}

export const usePnd = (
  companyId: string,
  from: string,
  to: string,
  form: 'pnd3' | 'pnd53',
  on: boolean,
) =>
  useQuery({
    queryKey: ['wht-report', companyId, 'pnd', form, from, to],
    enabled: on,
    queryFn: () =>
      rpc<PndLine[]>('report_wht_pnd', {
        p_company_id: companyId,
        p_from: from,
        p_to: to,
        p_form: form,
      }),
  })

export const useIssuedCerts = (companyId: string, from: string, to: string, on: boolean) =>
  useQuery({
    queryKey: ['wht-report', companyId, 'issued', from, to],
    enabled: on,
    queryFn: () =>
      rpc<IssuedCert[]>('report_wht_certificates', {
        p_company_id: companyId,
        p_from: from,
        p_to: to,
      }),
  })

export const useReceivedWht = (companyId: string, from: string, to: string, on: boolean) =>
  useQuery({
    queryKey: ['wht-report', companyId, 'received', from, to],
    enabled: on,
    queryFn: () =>
      rpc<ReceivedWht[]>('report_wht_received', {
        p_company_id: companyId,
        p_from: from,
        p_to: to,
      }),
  })
