import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AgentKey {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}
export interface OcrJob {
  id: string
  status: 'queued' | 'processing' | 'done' | 'failed' | 'needs_review'
  source: 'web' | 'mobile' | 'folder' | 'api'
  file_name: string
  error: string | null
  created_at: string
  finished_at: string | null
  result: {
    document_type?: string
    document_number?: string | null
    total?: number | null
    seller?: { name?: string | null } | null
  } | null
}
export interface Overview {
  month_count: number
  by_status: Record<string, number>
  agent_last_seen: string | null
  threshold: number
  /** connector seen in the last 2 minutes (it checks in every ~10 s) */
  online: boolean
}

const key = (companyId: string) => ['ocr', companyId] as const

export function useOverview(companyId: string) {
  return useQuery({
    queryKey: [...key(companyId), 'overview'],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ocr_overview', { p_company_id: companyId })
      if (error) throw error
      const o = data as unknown as Overview
      const seen = o.agent_last_seen ? new Date(o.agent_last_seen).getTime() : 0
      return { ...o, online: Date.now() - seen < 2 * 60 * 1000 }
    },
  })
}

export function useAgentKeys(companyId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...key(companyId), 'keys'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ocr_agent_keys')
        .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as AgentKey[]
    },
  })
}

export function useJobs(companyId: string) {
  return useQuery({
    queryKey: [...key(companyId), 'jobs'],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ocr_jobs')
        .select('id, status, source, file_name, error, created_at, finished_at, result')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as unknown as OcrJob[]
    },
  })
}

export function useOcrAction(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown> }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(fn, args)
      if (error) throw error
      return data as unknown
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(companyId) }),
  })
}
