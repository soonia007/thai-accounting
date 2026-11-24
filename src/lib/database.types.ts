export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_mappings: {
        Row: {
          account_id: string
          company_id: string
          role: Database['public']['Enums']['account_role']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          account_id: string
          company_id: string
          role: Database['public']['Enums']['account_role']
          updated_at?: string
        }
        Update: {
          account_id?: string
          company_id?: string
          role?: Database['public']['Enums']['account_role']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'account_mappings_company_id_account_id_fkey'
            columns: ['company_id', 'account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'account_mappings_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      account_templates: {
        Row: {
          business_type: Database['public']['Enums']['business_type']
          code: string
          id: number
          is_group: boolean
          mapping_role: Database['public']['Enums']['account_role'] | null
          name_en: string
          name_th: string
          parent_code: string | null
          sort_order: number
          type: Database['public']['Enums']['account_type']
        }
        ComputedFields: never
        Insert: {
          business_type: Database['public']['Enums']['business_type']
          code: string
          id?: never
          is_group?: boolean
          mapping_role?: Database['public']['Enums']['account_role'] | null
          name_en: string
          name_th: string
          parent_code?: string | null
          sort_order?: number
          type: Database['public']['Enums']['account_type']
        }
        Update: {
          business_type?: Database['public']['Enums']['business_type']
          code?: string
          id?: never
          is_group?: boolean
          mapping_role?: Database['public']['Enums']['account_role'] | null
          name_en?: string
          name_th?: string
          parent_code?: string | null
          sort_order?: number
          type?: Database['public']['Enums']['account_type']
        }
        Relationships: []
      }
      accounts: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_group: boolean
          is_system: boolean
          name_en: string | null
          name_th: string
          parent_id: string | null
          type: Database['public']['Enums']['account_type']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_group?: boolean
          is_system?: boolean
          name_en?: string | null
          name_th: string
          parent_id?: string | null
          type: Database['public']['Enums']['account_type']
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_group?: boolean
          is_system?: boolean
          name_en?: string | null
          name_th?: string
          parent_id?: string | null
          type?: Database['public']['Enums']['account_type']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'accounts_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'accounts_company_id_parent_id_fkey'
            columns: ['company_id', 'parent_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          branch_code: string
          branch_name: string | null
          business_type: Database['public']['Enums']['business_type']
          created_at: string
          created_by: string | null
          date_era: Database['public']['Enums']['date_era']
          doc_number_settings: NonNullable<Json>
          email: string | null
          fiscal_year_start_month: number
          id: string
          logo_path: string | null
          name: string
          name_en: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
          vat_rate: number
          vat_registered: boolean
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          branch_code?: string
          branch_name?: string | null
          business_type: Database['public']['Enums']['business_type']
          created_at?: string
          created_by?: string | null
          date_era?: Database['public']['Enums']['date_era']
          doc_number_settings?: NonNullable<Json>
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          logo_path?: string | null
          name: string
          name_en?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
          vat_rate?: number
          vat_registered?: boolean
        }
        Update: {
          address?: string | null
          branch_code?: string
          branch_name?: string | null
          business_type?: Database['public']['Enums']['business_type']
          created_at?: string
          created_by?: string | null
          date_era?: Database['public']['Enums']['date_era']
          doc_number_settings?: NonNullable<Json>
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          logo_path?: string | null
          name?: string
          name_en?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
          vat_rate?: number
          vat_registered?: boolean
        }
        Relationships: []
      }
      company_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database['public']['Enums']['member_role']
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role: Database['public']['Enums']['member_role']
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database['public']['Enums']['member_role']
        }
        Relationships: [
          {
            foreignKeyName: 'company_invitations_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          role: Database['public']['Enums']['member_role']
          user_id: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          role: Database['public']['Enums']['member_role']
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          role?: Database['public']['Enums']['member_role']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'company_members_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_invitation_id: string }; Returns: string }
      account_role_type: {
        Args: { p_role: Database['public']['Enums']['account_role'] }
        Returns: Database['public']['Enums']['account_type']
      }
      create_company: {
        Args: {
          p_address?: string
          p_branch_code?: string
          p_branch_name?: string
          p_business_type: Database['public']['Enums']['business_type']
          p_name: string
          p_tax_id?: string
          p_vat_rate?: number
          p_vat_registered?: boolean
        }
        Returns: string
      }
      is_valid_thai_tax_id: { Args: { p_tax_id: string }; Returns: boolean }
      my_invitations: {
        Args: Record<PropertyKey, never>
        Returns: {
          company_id: string
          company_name: string
          expires_at: string
          id: string
          role: Database['public']['Enums']['member_role']
        }[]
      }
      remove_member: { Args: { p_company_id: string; p_user_id: string }; Returns: undefined }
      update_member_role: {
        Args: {
          p_company_id: string
          p_role: Database['public']['Enums']['member_role']
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_role:
        | 'CASH'
        | 'BANK'
        | 'AR'
        | 'AP'
        | 'OUTPUT_VAT'
        | 'INPUT_VAT'
        | 'WHT_RECEIVABLE'
        | 'WHT_PAYABLE'
        | 'SALES_REVENUE'
        | 'SALES_RETURNS'
        | 'DEFAULT_EXPENSE'
        | 'INVENTORY'
        | 'RETAINED_EARNINGS'
      account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
      business_type: 'service' | 'trading' | 'manufacturing' | 'restaurant'
      date_era: 'BE' | 'CE'
      member_role: 'owner' | 'admin' | 'staff' | 'accountant' | 'viewer'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_role: [
        'CASH',
        'BANK',
        'AR',
        'AP',
        'OUTPUT_VAT',
        'INPUT_VAT',
        'WHT_RECEIVABLE',
        'WHT_PAYABLE',
        'SALES_REVENUE',
        'SALES_RETURNS',
        'DEFAULT_EXPENSE',
        'INVENTORY',
        'RETAINED_EARNINGS',
      ],
      account_type: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      business_type: ['service', 'trading', 'manufacturing', 'restaurant'],
      date_era: ['BE', 'CE'],
      member_role: ['owner', 'admin', 'staff', 'accountant', 'viewer'],
    },
  },
} as const
