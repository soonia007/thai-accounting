import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface WhtIncomeType {
  code: string
  name_th: string
  name_en: string
  section: string
  default_rate: number | null
}

/** Reference list of WHT income types (D6) — same for every company. */
export function useWhtIncomeTypes(enabled = true) {
  return useQuery({
    queryKey: ['wht-income-types'],
    enabled,
    staleTime: Infinity,
    queryFn: async (): Promise<WhtIncomeType[]> => {
      const { data, error } = await supabase
        .from('wht_income_types')
        .select('code, name_th, name_en, section, default_rate')
        .order('sort_order')
      if (error) throw error
      return data.map((r) => ({
        ...r,
        default_rate: r.default_rate === null ? null : Number(r.default_rate),
      }))
    },
  })
}
