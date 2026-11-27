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
      asset_categories: {
        Row: {
          accum_account_id: string
          asset_account_id: string
          company_id: string
          created_at: string
          default_life_months: number
          id: string
          is_active: boolean
          name: string
        }
        ComputedFields: never
        Insert: {
          accum_account_id: string
          asset_account_id: string
          company_id: string
          created_at?: string
          default_life_months: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          accum_account_id?: string
          asset_account_id?: string
          company_id?: string
          created_at?: string
          default_life_months?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'asset_categories_company_id_accum_account_id_fkey'
            columns: ['company_id', 'accum_account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'asset_categories_company_id_asset_account_id_fkey'
            columns: ['company_id', 'asset_account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'asset_categories_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      attachments: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          document_id: string | null
          file_name: string
          id: string
          mime_type: string | null
          payment_id: string | null
          size_bytes: number | null
          storage_path: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          payment_id?: string | null
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          payment_id?: string | null
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: 'attachments_company_id_document_id_fkey'
            columns: ['company_id', 'document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'attachments_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attachments_company_id_payment_id_fkey'
            columns: ['company_id', 'payment_id']
            isOneToOne: false
            referencedRelation: 'payments'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          at: string
          company_id: string | null
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        ComputedFields: never
        Insert: {
          action: string
          actor?: string | null
          at?: string
          company_id?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string
          company_id?: string | null
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_id: string
          account_name: string
          account_number: string
          bank_code: string
          branch: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          kind: Database['public']['Enums']['bank_account_kind']
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          account_id: string
          account_name: string
          account_number: string
          bank_code: string
          branch?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database['public']['Enums']['bank_account_kind']
          updated_at?: string
        }
        Update: {
          account_id?: string
          account_name?: string
          account_number?: string
          bank_code?: string
          branch?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database['public']['Enums']['bank_account_kind']
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_accounts_company_id_account_id_fkey'
            columns: ['company_id', 'account_id']
            isOneToOne: true
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'bank_accounts_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      bank_import_mappings: {
        Row: {
          bank_code: string
          company_id: string
          mapping: NonNullable<Json>
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          bank_code: string
          company_id: string
          mapping: NonNullable<Json>
          updated_at?: string
        }
        Update: {
          bank_code?: string
          company_id?: string
          mapping?: NonNullable<Json>
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_import_mappings_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      bank_matches: {
        Row: {
          company_id: string
          created_at: string
          id: string
          journal_line_id: string
          statement_line_id: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          journal_line_id: string
          statement_line_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          journal_line_id?: string
          statement_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_matches_company_id_statement_line_id_fkey'
            columns: ['company_id', 'statement_line_id']
            isOneToOne: false
            referencedRelation: 'bank_statement_lines'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'bank_matches_journal_line_id_fkey'
            columns: ['journal_line_id']
            isOneToOne: true
            referencedRelation: 'journal_lines'
            referencedColumns: ['id']
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          amount: number
          balance: number | null
          bank_account_id: string
          company_id: string
          description: string
          id: string
          line_no: number
          matched_at: string | null
          matched_by: string | null
          reference: string | null
          statement_id: string
          txn_date: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          balance?: number | null
          bank_account_id: string
          company_id: string
          description?: string
          id?: string
          line_no: number
          matched_at?: string | null
          matched_by?: string | null
          reference?: string | null
          statement_id: string
          txn_date: string
        }
        Update: {
          amount?: number
          balance?: number | null
          bank_account_id?: string
          company_id?: string
          description?: string
          id?: string
          line_no?: number
          matched_at?: string | null
          matched_by?: string | null
          reference?: string | null
          statement_id?: string
          txn_date?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bank_statement_lines_company_id_bank_account_id_fkey'
            columns: ['company_id', 'bank_account_id']
            isOneToOne: false
            referencedRelation: 'bank_accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'bank_statement_lines_company_id_statement_id_fkey'
            columns: ['company_id', 'statement_id']
            isOneToOne: false
            referencedRelation: 'bank_statements'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      bank_statements: {
        Row: {
          bank_account_id: string
          company_id: string
          date_from: string | null
          date_to: string | null
          file_name: string | null
          id: string
          imported_at: string
          imported_by: string | null
        }
        ComputedFields: never
        Insert: {
          bank_account_id: string
          company_id: string
          date_from?: string | null
          date_to?: string | null
          file_name?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
        }
        Update: {
          bank_account_id?: string
          company_id?: string
          date_from?: string | null
          date_to?: string | null
          file_name?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'bank_statements_company_id_bank_account_id_fkey'
            columns: ['company_id', 'bank_account_id']
            isOneToOne: false
            referencedRelation: 'bank_accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'bank_statements_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          branch_code: string
          branch_name: string | null
          business_type: Database['public']['Enums']['business_type']
          cost_method: string | null
          created_at: string
          created_by: string | null
          date_era: Database['public']['Enums']['date_era']
          doc_number_settings: NonNullable<Json>
          email: string | null
          fiscal_year_start_month: number
          id: string
          locked_through: string | null
          logo_path: string | null
          name: string
          name_en: string | null
          ocr_review_threshold: number
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
          cost_method?: string | null
          created_at?: string
          created_by?: string | null
          date_era?: Database['public']['Enums']['date_era']
          doc_number_settings?: NonNullable<Json>
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          locked_through?: string | null
          logo_path?: string | null
          name: string
          name_en?: string | null
          ocr_review_threshold?: number
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
          cost_method?: string | null
          created_at?: string
          created_by?: string | null
          date_era?: Database['public']['Enums']['date_era']
          doc_number_settings?: NonNullable<Json>
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          locked_through?: string | null
          logo_path?: string | null
          name?: string
          name_en?: string | null
          ocr_review_threshold?: number
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
      contacts: {
        Row: {
          address: string | null
          branch_code: string
          branch_name: string | null
          code: string
          company_id: string
          contact_person: string | null
          contact_type: Database['public']['Enums']['contact_type']
          created_at: string
          credit_term_days: number
          email: string | null
          entity_type: Database['public']['Enums']['entity_type']
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          branch_code?: string
          branch_name?: string | null
          code: string
          company_id: string
          contact_person?: string | null
          contact_type?: Database['public']['Enums']['contact_type']
          created_at?: string
          credit_term_days?: number
          email?: string | null
          entity_type?: Database['public']['Enums']['entity_type']
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          branch_code?: string
          branch_name?: string | null
          code?: string
          company_id?: string
          contact_person?: string | null
          contact_type?: Database['public']['Enums']['contact_type']
          created_at?: string
          credit_term_days?: number
          email?: string | null
          entity_type?: Database['public']['Enums']['entity_type']
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'contacts_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      depreciation_lines: {
        Row: {
          amount: number
          asset_id: string
          run_id: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          asset_id: string
          run_id: string
        }
        Update: {
          amount?: number
          asset_id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'depreciation_lines_asset_id_fkey'
            columns: ['asset_id']
            isOneToOne: false
            referencedRelation: 'fixed_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'depreciation_lines_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'depreciation_runs'
            referencedColumns: ['id']
          },
        ]
      }
      depreciation_runs: {
        Row: {
          company_id: string
          id: string
          month: string
          posted_at: string
          posted_by: string | null
          status: Database['public']['Enums']['document_status']
          total: number
        }
        ComputedFields: never
        Insert: {
          company_id: string
          id?: string
          month: string
          posted_at?: string
          posted_by?: string | null
          status?: Database['public']['Enums']['document_status']
          total: number
        }
        Update: {
          company_id?: string
          id?: string
          month?: string
          posted_at?: string
          posted_by?: string | null
          status?: Database['public']['Enums']['document_status']
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: 'depreciation_runs_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      doc_sequences: {
        Row: {
          company_id: string
          last_number: number
          period_key: string
          series: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          last_number?: number
          period_key: string
          series: string
        }
        Update: {
          company_id?: string
          last_number?: number
          period_key?: string
          series?: string
        }
        Relationships: [
          {
            foreignKeyName: 'doc_sequences_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      document_lines: {
        Row: {
          account_id: string | null
          base_amount: number
          company_id: string
          description: string
          discount: number
          document_id: string
          id: string
          item_kind: Database['public']['Enums']['product_kind']
          line_no: number
          product_id: string | null
          qty: number
          unit_price: number
          vat_amount: number
          vat_claimable: boolean
          vat_type: Database['public']['Enums']['product_vat_type']
          wht_amount: number
          wht_income_type: string | null
          wht_rate: number
        }
        ComputedFields: never
        Insert: {
          account_id?: string | null
          base_amount?: number
          company_id: string
          description?: string
          discount?: number
          document_id: string
          id?: string
          item_kind?: Database['public']['Enums']['product_kind']
          line_no: number
          product_id?: string | null
          qty?: number
          unit_price?: number
          vat_amount?: number
          vat_claimable?: boolean
          vat_type?: Database['public']['Enums']['product_vat_type']
          wht_amount?: number
          wht_income_type?: string | null
          wht_rate?: number
        }
        Update: {
          account_id?: string | null
          base_amount?: number
          company_id?: string
          description?: string
          discount?: number
          document_id?: string
          id?: string
          item_kind?: Database['public']['Enums']['product_kind']
          line_no?: number
          product_id?: string | null
          qty?: number
          unit_price?: number
          vat_amount?: number
          vat_claimable?: boolean
          vat_type?: Database['public']['Enums']['product_vat_type']
          wht_amount?: number
          wht_income_type?: string | null
          wht_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: 'document_lines_company_id_account_id_fkey'
            columns: ['company_id', 'account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'document_lines_company_id_document_id_fkey'
            columns: ['company_id', 'document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'document_lines_company_id_product_id_fkey'
            columns: ['company_id', 'product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'document_lines_wht_income_type_fkey'
            columns: ['wht_income_type']
            isOneToOne: false
            referencedRelation: 'wht_income_types'
            referencedColumns: ['code']
          },
        ]
      }
      document_shares: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          document_id: string | null
          expires_at: string | null
          payment_id: string | null
          revoked_at: string | null
          token: string
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          expires_at?: string | null
          payment_id?: string | null
          revoked_at?: string | null
          token: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          expires_at?: string | null
          payment_id?: string | null
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: 'document_shares_company_id_document_id_fkey'
            columns: ['company_id', 'document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'document_shares_company_id_payment_id_fkey'
            columns: ['company_id', 'payment_id']
            isOneToOne: false
            referencedRelation: 'payments'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      documents: {
        Row: {
          company_id: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          doc_date: string
          due_date: string | null
          id: string
          net_total: number
          notes: string | null
          number: string | null
          payment_account_id: string | null
          posted_at: string | null
          posted_by: string | null
          received_wht_cert_date: string | null
          received_wht_cert_no: string | null
          ref_document_id: string | null
          reference: string | null
          restock: boolean
          source: Database['public']['Enums']['document_source']
          status: Database['public']['Enums']['document_status']
          subtotal: number
          tax_invoice_date: string | null
          tax_invoice_no: string | null
          total: number
          type: Database['public']['Enums']['document_type']
          updated_at: string
          vat_claim_month: string | null
          vat_deferred_total: number
          vat_mode: Database['public']['Enums']['vat_mode']
          vat_rate: number
          vat_total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          wht_condition: Database['public']['Enums']['wht_condition']
          wht_total: number
        }
        ComputedFields: never
        Insert: {
          company_id: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_date?: string
          due_date?: string | null
          id?: string
          net_total?: number
          notes?: string | null
          number?: string | null
          payment_account_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          received_wht_cert_date?: string | null
          received_wht_cert_no?: string | null
          ref_document_id?: string | null
          reference?: string | null
          restock?: boolean
          source?: Database['public']['Enums']['document_source']
          status?: Database['public']['Enums']['document_status']
          subtotal?: number
          tax_invoice_date?: string | null
          tax_invoice_no?: string | null
          total?: number
          type: Database['public']['Enums']['document_type']
          updated_at?: string
          vat_claim_month?: string | null
          vat_deferred_total?: number
          vat_mode?: Database['public']['Enums']['vat_mode']
          vat_rate?: number
          vat_total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wht_condition?: Database['public']['Enums']['wht_condition']
          wht_total?: number
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_date?: string
          due_date?: string | null
          id?: string
          net_total?: number
          notes?: string | null
          number?: string | null
          payment_account_id?: string | null
          posted_at?: string | null
          posted_by?: string | null
          received_wht_cert_date?: string | null
          received_wht_cert_no?: string | null
          ref_document_id?: string | null
          reference?: string | null
          restock?: boolean
          source?: Database['public']['Enums']['document_source']
          status?: Database['public']['Enums']['document_status']
          subtotal?: number
          tax_invoice_date?: string | null
          tax_invoice_no?: string | null
          total?: number
          type?: Database['public']['Enums']['document_type']
          updated_at?: string
          vat_claim_month?: string | null
          vat_deferred_total?: number
          vat_mode?: Database['public']['Enums']['vat_mode']
          vat_rate?: number
          vat_total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wht_condition?: Database['public']['Enums']['wht_condition']
          wht_total?: number
        }
        Relationships: [
          {
            foreignKeyName: 'documents_company_id_contact_id_fkey'
            columns: ['company_id', 'contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'documents_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_company_id_payment_account_id_fkey'
            columns: ['company_id', 'payment_account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'documents_company_id_ref_document_id_fkey'
            columns: ['company_id', 'ref_document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      fiscal_year_closes: {
        Row: {
          closed_at: string
          closed_by: string | null
          company_id: string
          id: string
          net_profit: number
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          year_end: string
          year_start: string
        }
        ComputedFields: never
        Insert: {
          closed_at?: string
          closed_by?: string | null
          company_id: string
          id?: string
          net_profit: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          year_end: string
          year_start: string
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          company_id?: string
          id?: string
          net_profit?: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          year_end?: string
          year_start?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fiscal_year_closes_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      fixed_assets: {
        Row: {
          acquired_on: string
          category_id: string
          code: string
          company_id: string
          cost: number
          created_at: string
          created_by: string | null
          disposal_accum: number | null
          disposal_document_id: string | null
          disposal_proceeds: number | null
          disposed_on: string | null
          id: string
          life_months: number
          name: string
          notes: string | null
          opening_accum: number
          salvage: number
          source: string
          source_document_id: string | null
          source_line_id: string | null
          status: string
        }
        ComputedFields: never
        Insert: {
          acquired_on: string
          category_id: string
          code: string
          company_id: string
          cost: number
          created_at?: string
          created_by?: string | null
          disposal_accum?: number | null
          disposal_document_id?: string | null
          disposal_proceeds?: number | null
          disposed_on?: string | null
          id?: string
          life_months: number
          name: string
          notes?: string | null
          opening_accum?: number
          salvage?: number
          source: string
          source_document_id?: string | null
          source_line_id?: string | null
          status?: string
        }
        Update: {
          acquired_on?: string
          category_id?: string
          code?: string
          company_id?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          disposal_accum?: number | null
          disposal_document_id?: string | null
          disposal_proceeds?: number | null
          disposed_on?: string | null
          id?: string
          life_months?: number
          name?: string
          notes?: string | null
          opening_accum?: number
          salvage?: number
          source?: string
          source_document_id?: string | null
          source_line_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'fixed_assets_company_id_category_id_fkey'
            columns: ['company_id', 'category_id']
            isOneToOne: false
            referencedRelation: 'asset_categories'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'fixed_assets_company_id_disposal_document_id_fkey'
            columns: ['company_id', 'disposal_document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'fixed_assets_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fixed_assets_company_id_source_document_id_fkey'
            columns: ['company_id', 'source_document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'fixed_assets_source_line_id_fkey'
            columns: ['source_line_id']
            isOneToOne: true
            referencedRelation: 'document_lines'
            referencedColumns: ['id']
          },
        ]
      }
      journal_entries: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          depreciation_run_id: string | null
          description: string | null
          document_id: string | null
          entry_date: string
          fiscal_close_id: string | null
          fixed_asset_id: string | null
          id: string
          manual_journal_id: string | null
          payment_id: string | null
          reverses_entry_id: string | null
          stock_adjustment_id: string | null
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          depreciation_run_id?: string | null
          description?: string | null
          document_id?: string | null
          entry_date: string
          fiscal_close_id?: string | null
          fixed_asset_id?: string | null
          id?: string
          manual_journal_id?: string | null
          payment_id?: string | null
          reverses_entry_id?: string | null
          stock_adjustment_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          depreciation_run_id?: string | null
          description?: string | null
          document_id?: string | null
          entry_date?: string
          fiscal_close_id?: string | null
          fixed_asset_id?: string | null
          id?: string
          manual_journal_id?: string | null
          payment_id?: string | null
          reverses_entry_id?: string | null
          stock_adjustment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'journal_entries_company_id_document_id_fkey'
            columns: ['company_id', 'document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'journal_entries_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_entries_company_id_payment_id_fkey'
            columns: ['company_id', 'payment_id']
            isOneToOne: false
            referencedRelation: 'payments'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'journal_entries_depreciation_run_fk'
            columns: ['company_id', 'depreciation_run_id']
            isOneToOne: false
            referencedRelation: 'depreciation_runs'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'journal_entries_fiscal_close_fk'
            columns: ['company_id', 'fiscal_close_id']
            isOneToOne: false
            referencedRelation: 'fiscal_year_closes'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'journal_entries_fixed_asset_fk'
            columns: ['company_id', 'fixed_asset_id']
            isOneToOne: false
            referencedRelation: 'fixed_assets'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'journal_entries_manual_journal_fk'
            columns: ['company_id', 'manual_journal_id']
            isOneToOne: false
            referencedRelation: 'manual_journals'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'journal_entries_reverses_entry_id_fkey'
            columns: ['reverses_entry_id']
            isOneToOne: false
            referencedRelation: 'journal_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_entries_stock_adjustment_fk'
            columns: ['company_id', 'stock_adjustment_id']
            isOneToOne: false
            referencedRelation: 'stock_adjustments'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          company_id: string
          contact_id: string | null
          credit: number
          debit: number
          description: string | null
          entry_id: string
          id: string
          line_no: number
        }
        ComputedFields: never
        Insert: {
          account_id: string
          company_id: string
          contact_id?: string | null
          credit?: number
          debit?: number
          description?: string | null
          entry_id: string
          id?: string
          line_no: number
        }
        Update: {
          account_id?: string
          company_id?: string
          contact_id?: string | null
          credit?: number
          debit?: number
          description?: string | null
          entry_id?: string
          id?: string
          line_no?: number
        }
        Relationships: [
          {
            foreignKeyName: 'journal_lines_company_id_account_id_fkey'
            columns: ['company_id', 'account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'journal_lines_company_id_contact_id_fkey'
            columns: ['company_id', 'contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'journal_lines_company_id_entry_id_fkey'
            columns: ['company_id', 'entry_id']
            isOneToOne: false
            referencedRelation: 'journal_entries'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      manual_journal_lines: {
        Row: {
          account_id: string | null
          company_id: string
          contact_id: string | null
          credit: number
          debit: number
          description: string | null
          id: string
          journal_id: string
          line_no: number
        }
        ComputedFields: never
        Insert: {
          account_id?: string | null
          company_id: string
          contact_id?: string | null
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_id: string
          line_no: number
        }
        Update: {
          account_id?: string | null
          company_id?: string
          contact_id?: string | null
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_id?: string
          line_no?: number
        }
        Relationships: [
          {
            foreignKeyName: 'manual_journal_lines_company_id_account_id_fkey'
            columns: ['company_id', 'account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'manual_journal_lines_company_id_contact_id_fkey'
            columns: ['company_id', 'contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'manual_journal_lines_company_id_journal_id_fkey'
            columns: ['company_id', 'journal_id']
            isOneToOne: false
            referencedRelation: 'manual_journals'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      manual_journals: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          memo: string | null
          number: string | null
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          status: Database['public']['Enums']['document_status']
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          memo?: string | null
          number?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: Database['public']['Enums']['document_status']
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          memo?: string | null
          number?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          status?: Database['public']['Enums']['document_status']
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'manual_journals_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      ocr_agent_keys: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'ocr_agent_keys_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      ocr_jobs: {
        Row: {
          agent_key_id: string | null
          attempts: number
          company_id: string
          created_at: string
          created_by: string | null
          document_id: string | null
          error: string | null
          file_name: string
          file_sha256: string | null
          finished_at: string | null
          id: string
          mime_type: string | null
          raw_json: Json | null
          result: Json | null
          size_bytes: number | null
          source: Database['public']['Enums']['ocr_job_source']
          started_at: string | null
          status: Database['public']['Enums']['ocr_job_status']
          storage_path: string
        }
        ComputedFields: never
        Insert: {
          agent_key_id?: string | null
          attempts?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          error?: string | null
          file_name: string
          file_sha256?: string | null
          finished_at?: string | null
          id?: string
          mime_type?: string | null
          raw_json?: Json | null
          result?: Json | null
          size_bytes?: number | null
          source: Database['public']['Enums']['ocr_job_source']
          started_at?: string | null
          status?: Database['public']['Enums']['ocr_job_status']
          storage_path: string
        }
        Update: {
          agent_key_id?: string | null
          attempts?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          error?: string | null
          file_name?: string
          file_sha256?: string | null
          finished_at?: string | null
          id?: string
          mime_type?: string | null
          raw_json?: Json | null
          result?: Json | null
          size_bytes?: number | null
          source?: Database['public']['Enums']['ocr_job_source']
          started_at?: string | null
          status?: Database['public']['Enums']['ocr_job_status']
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ocr_jobs_agent_key_id_fkey'
            columns: ['agent_key_id']
            isOneToOne: false
            referencedRelation: 'ocr_agent_keys'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ocr_jobs_company_id_document_id_fkey'
            columns: ['company_id', 'document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'ocr_jobs_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          company_id: string
          document_id: string
          id: string
          payment_id: string
          vat_transferred: number
          wht_amount: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          company_id: string
          document_id: string
          id?: string
          payment_id: string
          vat_transferred?: number
          wht_amount?: number
        }
        Update: {
          amount?: number
          company_id?: string
          document_id?: string
          id?: string
          payment_id?: string
          vat_transferred?: number
          wht_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: 'payment_allocations_company_id_document_id_fkey'
            columns: ['company_id', 'document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'payment_allocations_company_id_payment_id_fkey'
            columns: ['company_id', 'payment_id']
            isOneToOne: false
            referencedRelation: 'payments'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          company_id: string
          contact_id: string
          created_at: string
          created_by: string | null
          direction: Database['public']['Enums']['payment_direction']
          id: string
          notes: string | null
          number: string | null
          pay_date: string
          payment_account_id: string
          posted_at: string | null
          posted_by: string | null
          received_wht_cert_date: string | null
          received_wht_cert_no: string | null
          reference: string | null
          status: Database['public']['Enums']['document_status']
          tax_invoice_date: string | null
          tax_invoice_no: string | null
          updated_at: string
          vat_claim_month: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          wht_amount: number
          wht_condition: Database['public']['Enums']['wht_condition']
        }
        ComputedFields: never
        Insert: {
          amount?: number
          company_id: string
          contact_id: string
          created_at?: string
          created_by?: string | null
          direction: Database['public']['Enums']['payment_direction']
          id?: string
          notes?: string | null
          number?: string | null
          pay_date?: string
          payment_account_id: string
          posted_at?: string | null
          posted_by?: string | null
          received_wht_cert_date?: string | null
          received_wht_cert_no?: string | null
          reference?: string | null
          status?: Database['public']['Enums']['document_status']
          tax_invoice_date?: string | null
          tax_invoice_no?: string | null
          updated_at?: string
          vat_claim_month?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wht_amount?: number
          wht_condition?: Database['public']['Enums']['wht_condition']
        }
        Update: {
          amount?: number
          company_id?: string
          contact_id?: string
          created_at?: string
          created_by?: string | null
          direction?: Database['public']['Enums']['payment_direction']
          id?: string
          notes?: string | null
          number?: string | null
          pay_date?: string
          payment_account_id?: string
          posted_at?: string | null
          posted_by?: string | null
          received_wht_cert_date?: string | null
          received_wht_cert_no?: string | null
          reference?: string | null
          status?: Database['public']['Enums']['document_status']
          tax_invoice_date?: string | null
          tax_invoice_no?: string | null
          updated_at?: string
          vat_claim_month?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wht_amount?: number
          wht_condition?: Database['public']['Enums']['wht_condition']
        }
        Relationships: [
          {
            foreignKeyName: 'payments_company_id_contact_id_fkey'
            columns: ['company_id', 'contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'payments_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_company_id_payment_account_id_fkey'
            columns: ['company_id', 'payment_account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      period_closes: {
        Row: {
          closed_at: string
          closed_by: string | null
          company_id: string
          id: string
          month: string
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
        }
        ComputedFields: never
        Insert: {
          closed_at?: string
          closed_by?: string | null
          company_id: string
          id?: string
          month: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          company_id?: string
          id?: string
          month?: string
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'period_closes_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          expense_account_id: string | null
          id: string
          income_account_id: string | null
          is_active: boolean
          kind: Database['public']['Enums']['product_kind']
          name: string
          purchase_price: number | null
          reorder_level: number | null
          sale_price: number | null
          track_stock: boolean
          unit: string | null
          updated_at: string
          vat_type: Database['public']['Enums']['product_vat_type']
          wht_income_type: string | null
        }
        ComputedFields: never
        Insert: {
          code: string
          company_id: string
          created_at?: string
          description?: string | null
          expense_account_id?: string | null
          id?: string
          income_account_id?: string | null
          is_active?: boolean
          kind?: Database['public']['Enums']['product_kind']
          name: string
          purchase_price?: number | null
          reorder_level?: number | null
          sale_price?: number | null
          track_stock?: boolean
          unit?: string | null
          updated_at?: string
          vat_type?: Database['public']['Enums']['product_vat_type']
          wht_income_type?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          expense_account_id?: string | null
          id?: string
          income_account_id?: string | null
          is_active?: boolean
          kind?: Database['public']['Enums']['product_kind']
          name?: string
          purchase_price?: number | null
          reorder_level?: number | null
          sale_price?: number | null
          track_stock?: boolean
          unit?: string | null
          updated_at?: string
          vat_type?: Database['public']['Enums']['product_vat_type']
          wht_income_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_company_id_expense_account_id_fkey'
            columns: ['company_id', 'expense_account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'products_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_company_id_income_account_id_fkey'
            columns: ['company_id', 'income_account_id']
            isOneToOne: false
            referencedRelation: 'accounts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'products_wht_income_type_fkey'
            columns: ['wht_income_type']
            isOneToOne: false
            referencedRelation: 'wht_income_types'
            referencedColumns: ['code']
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
      stock_adjustments: {
        Row: {
          adj_date: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          memo: string | null
          number: string
          status: Database['public']['Enums']['document_status']
          void_reason: string | null
          voided_at: string | null
        }
        ComputedFields: never
        Insert: {
          adj_date: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          memo?: string | null
          number: string
          status?: Database['public']['Enums']['document_status']
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          adj_date?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          memo?: string | null
          number?: string
          status?: Database['public']['Enums']['document_status']
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'stock_adjustments_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      stock_consumptions: {
        Row: {
          amount: number
          layer_movement_id: string
          out_movement_id: string
          qty: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          layer_movement_id: string
          out_movement_id: string
          qty: number
        }
        Update: {
          amount?: number
          layer_movement_id?: string
          out_movement_id?: string
          qty?: number
        }
        Relationships: [
          {
            foreignKeyName: 'stock_consumptions_layer_movement_id_fkey'
            columns: ['layer_movement_id']
            isOneToOne: false
            referencedRelation: 'stock_movements'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_consumptions_out_movement_id_fkey'
            columns: ['out_movement_id']
            isOneToOne: false
            referencedRelation: 'stock_movements'
            referencedColumns: ['id']
          },
        ]
      }
      stock_movements: {
        Row: {
          adjustment_id: string | null
          amount: number
          company_id: string
          created_at: string
          document_id: string | null
          id: string
          kind: string
          move_date: string
          product_id: string
          qty: number
          remaining_amount: number
          remaining_qty: number
          reverses_movement_id: string | null
          seq: number
          voided_at: string | null
          warehouse_id: string
        }
        ComputedFields: never
        Insert: {
          adjustment_id?: string | null
          amount: number
          company_id: string
          created_at?: string
          document_id?: string | null
          id?: string
          kind: string
          move_date: string
          product_id: string
          qty: number
          remaining_amount?: number
          remaining_qty?: number
          reverses_movement_id?: string | null
          seq?: number
          voided_at?: string | null
          warehouse_id: string
        }
        Update: {
          adjustment_id?: string | null
          amount?: number
          company_id?: string
          created_at?: string
          document_id?: string | null
          id?: string
          kind?: string
          move_date?: string
          product_id?: string
          qty?: number
          remaining_amount?: number
          remaining_qty?: number
          reverses_movement_id?: string | null
          seq?: number
          voided_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_movements_company_id_adjustment_id_fkey'
            columns: ['company_id', 'adjustment_id']
            isOneToOne: false
            referencedRelation: 'stock_adjustments'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'stock_movements_company_id_document_id_fkey'
            columns: ['company_id', 'document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'stock_movements_company_id_product_id_fkey'
            columns: ['company_id', 'product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'stock_movements_company_id_warehouse_id_fkey'
            columns: ['company_id', 'warehouse_id']
            isOneToOne: false
            referencedRelation: 'warehouses'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'stock_movements_reverses_movement_id_fkey'
            columns: ['reverses_movement_id']
            isOneToOne: false
            referencedRelation: 'stock_movements'
            referencedColumns: ['id']
          },
        ]
      }
      vat_returns: {
        Row: {
          carried_in: number
          company_id: string
          excess_choice: string | null
          filed_at: string
          filed_by: string | null
          id: string
          input_vat: number
          month: string
          net: number
          output_vat: number
          summary: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          carried_in?: number
          company_id: string
          excess_choice?: string | null
          filed_at?: string
          filed_by?: string | null
          id?: string
          input_vat: number
          month: string
          net: number
          output_vat: number
          summary: NonNullable<Json>
        }
        Update: {
          carried_in?: number
          company_id?: string
          excess_choice?: string | null
          filed_at?: string
          filed_by?: string | null
          id?: string
          input_vat?: number
          month?: string
          net?: number
          output_vat?: number
          summary?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: 'vat_returns_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      warehouses: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
        }
        ComputedFields: never
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'warehouses_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
        ]
      }
      wht_certificate_lines: {
        Row: {
          certificate_id: string
          company_id: string
          id: string
          income_amount: number
          income_type: string
          line_no: number
          tax_amount: number
          wht_rate: number
        }
        ComputedFields: never
        Insert: {
          certificate_id: string
          company_id: string
          id?: string
          income_amount: number
          income_type: string
          line_no: number
          tax_amount: number
          wht_rate: number
        }
        Update: {
          certificate_id?: string
          company_id?: string
          id?: string
          income_amount?: number
          income_type?: string
          line_no?: number
          tax_amount?: number
          wht_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: 'wht_certificate_lines_company_id_certificate_id_fkey'
            columns: ['company_id', 'certificate_id']
            isOneToOne: false
            referencedRelation: 'wht_certificates'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'wht_certificate_lines_income_type_fkey'
            columns: ['income_type']
            isOneToOne: false
            referencedRelation: 'wht_income_types'
            referencedColumns: ['code']
          },
        ]
      }
      wht_certificates: {
        Row: {
          cert_date: string
          company_id: string
          condition: Database['public']['Enums']['wht_condition']
          contact_id: string
          created_at: string
          document_id: string | null
          form: Database['public']['Enums']['wht_form']
          id: string
          number: string
          payment_id: string | null
          total_income: number
          total_tax: number
          voided_at: string | null
        }
        ComputedFields: never
        Insert: {
          cert_date: string
          company_id: string
          condition: Database['public']['Enums']['wht_condition']
          contact_id: string
          created_at?: string
          document_id?: string | null
          form: Database['public']['Enums']['wht_form']
          id?: string
          number: string
          payment_id?: string | null
          total_income: number
          total_tax: number
          voided_at?: string | null
        }
        Update: {
          cert_date?: string
          company_id?: string
          condition?: Database['public']['Enums']['wht_condition']
          contact_id?: string
          created_at?: string
          document_id?: string | null
          form?: Database['public']['Enums']['wht_form']
          id?: string
          number?: string
          payment_id?: string | null
          total_income?: number
          total_tax?: number
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'wht_certificates_company_id_contact_id_fkey'
            columns: ['company_id', 'contact_id']
            isOneToOne: false
            referencedRelation: 'contacts'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'wht_certificates_company_id_document_id_fkey'
            columns: ['company_id', 'document_id']
            isOneToOne: false
            referencedRelation: 'documents'
            referencedColumns: ['company_id', 'id']
          },
          {
            foreignKeyName: 'wht_certificates_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'companies'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wht_certificates_company_id_payment_id_fkey'
            columns: ['company_id', 'payment_id']
            isOneToOne: false
            referencedRelation: 'payments'
            referencedColumns: ['company_id', 'id']
          },
        ]
      }
      wht_income_types: {
        Row: {
          code: string
          default_rate: number | null
          form_row: string
          name_en: string
          name_th: string
          section: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          code: string
          default_rate?: number | null
          form_row: string
          name_en: string
          name_th: string
          section: string
          sort_order: number
        }
        Update: {
          code?: string
          default_rate?: number | null
          form_row?: string
          name_en?: string
          name_th?: string
          section?: string
          sort_order?: number
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
      bank_match_suggestions: { Args: { p_bank_account_id: string }; Returns: Json }
      bank_reconcile_data: { Args: { p_bank_account_id: string }; Returns: Json }
      bank_reconciliation: {
        Args: { p_as_of: string; p_bank_account_id: string; p_statement_balance?: number }
        Returns: Json
      }
      calc_line: {
        Args: {
          p_discount: number
          p_qty: number
          p_unit_price: number
          p_vat_mode: Database['public']['Enums']['vat_mode']
          p_vat_rate: number
          p_wht_rate: number
        }
        Returns: Record<string, unknown>
      }
      close_fiscal_year: { Args: { p_company_id: string; p_year_end: string }; Returns: string }
      close_period: { Args: { p_company_id: string; p_month: string }; Returns: undefined }
      create_bank_account_with_ledger: {
        Args: {
          p_account_name: string
          p_account_number: string
          p_bank_code: string
          p_branch?: string
          p_company_id: string
          p_kind?: Database['public']['Enums']['bank_account_kind']
          p_ledger_code: string
          p_ledger_name: string
        }
        Returns: string
      }
      create_bank_adjustment: {
        Args: { p_account_id: string; p_memo?: string; p_statement_line_id: string }
        Returns: string
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
      create_ocr_agent_key: { Args: { p_company_id: string; p_name: string }; Returns: string }
      create_ocr_job: {
        Args: {
          p_company_id: string
          p_file_name: string
          p_mime: string
          p_sha256?: string
          p_size: number
          p_source?: Database['public']['Enums']['ocr_job_source']
          p_storage_path: string
        }
        Returns: string
      }
      create_share_link: {
        Args: { p_document_id?: string; p_expires_at?: string; p_payment_id?: string }
        Returns: string
      }
      dashboard_full: { Args: { p_company_ids: string[]; p_months?: number }; Returns: Json }
      dashboard_summary: { Args: { p_company_id: string; p_months?: number }; Returns: Json }
      depreciation_preview: { Args: { p_company_id: string; p_month: string }; Returns: Json }
      disposal_preview: {
        Args: { p_asset_id: string; p_date: string; p_proceeds: number }
        Returns: Json
      }
      dispose_fixed_asset: { Args: { p_payload: Json }; Returns: string }
      document_balance: { Args: { p_document_id: string }; Returns: Json }
      file_vat_return: {
        Args: {
          p_carried_in?: number
          p_company_id: string
          p_excess_choice?: string
          p_month: string
        }
        Returns: undefined
      }
      fiscal_year_preview: { Args: { p_company_id: string; p_year_end: string }; Returns: Json }
      fixed_asset_register: { Args: { p_as_of: string; p_company_id: string }; Returns: Json }
      get_shared_document: { Args: { p_token: string }; Returns: Json }
      import_bank_statement: {
        Args: { p_bank_account_id: string; p_file_name: string; p_lines: Json; p_mapping?: Json }
        Returns: Json
      }
      init_asset_categories: { Args: { p_company_id: string }; Returns: undefined }
      is_valid_thai_tax_id: { Args: { p_tax_id: string }; Returns: boolean }
      list_documents: {
        Args: { p_company_id: string; p_types: Database['public']['Enums']['document_type'][] }
        Returns: {
          contact_id: string
          contact_name: string
          created_at: string
          doc_date: string
          due_date: string
          id: string
          number: string
          outstanding: number
          paid: number
          payment_status: string
          ref_document_id: string
          status: Database['public']['Enums']['document_status']
          total: number
          type: Database['public']['Enums']['document_type']
        }[]
      }
      list_payments: {
        Args: {
          p_company_id: string
          p_direction: Database['public']['Enums']['payment_direction']
        }
        Returns: {
          amount: number
          contact_id: string
          contact_name: string
          created_at: string
          documents: string
          id: string
          number: string
          pay_date: string
          status: Database['public']['Enums']['document_status']
          wht_amount: number
        }[]
      }
      match_bank_line: {
        Args: { p_journal_line_ids: string[]; p_statement_line_id: string }
        Returns: undefined
      }
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
      ocr_agent_auth: { Args: { p_key: string }; Returns: Json }
      ocr_agent_claim: { Args: { p_key_id: string; p_limit?: number }; Returns: Json }
      ocr_agent_create_job: {
        Args: {
          p_file_name: string
          p_key_id: string
          p_mime: string
          p_sha256: string
          p_size: number
          p_storage_path: string
        }
        Returns: Json
      }
      ocr_agent_submit: {
        Args: { p_error: string; p_job_id: string; p_key_id: string; p_raw: Json; p_result: Json }
        Returns: Json
      }
      ocr_overview: { Args: { p_company_id: string }; Returns: Json }
      open_documents: {
        Args: {
          p_company_id: string
          p_contact_id: string
          p_direction: Database['public']['Enums']['payment_direction']
        }
        Returns: {
          deferred_vat_remaining: number
          doc_date: string
          due_date: string
          id: string
          number: string
          outstanding: number
          total: number
          type: Database['public']['Enums']['document_type']
          wht_total: number
        }[]
      }
      period_close_checklist: { Args: { p_company_id: string; p_month: string }; Returns: Json }
      post_document: { Args: { p_document_id: string }; Returns: Json }
      post_manual_journal: { Args: { p_id: string }; Returns: Json }
      post_payment: { Args: { p_payment_id: string }; Returns: Json }
      post_stock_adjustment: { Args: { p_payload: Json }; Returns: string }
      print_document: { Args: { p_document_id?: string; p_payment_id?: string }; Returns: Json }
      print_wht_certificate: { Args: { p_certificate_id: string }; Returns: Json }
      register_fixed_asset: { Args: { p_payload: Json }; Returns: string }
      remove_member: { Args: { p_company_id: string; p_user_id: string }; Returns: undefined }
      reopen_fiscal_year: {
        Args: { p_company_id: string; p_reason: string; p_year_end: string }
        Returns: undefined
      }
      reopen_period: {
        Args: { p_company_id: string; p_month: string; p_reason: string }
        Returns: undefined
      }
      report_balance_sheet: { Args: { p_as_of: string; p_company_ids: string[] }; Returns: Json }
      report_general_ledger: {
        Args: { p_account_code?: string; p_company_ids: string[]; p_from: string; p_to: string }
        Returns: Json
      }
      report_income_statement: {
        Args: { p_company_ids: string[]; p_from: string; p_to: string }
        Returns: Json
      }
      report_receivable_payable: {
        Args: { p_as_of: string; p_company_ids: string[]; p_kind: string }
        Returns: Json
      }
      report_trial_balance: {
        Args: { p_company_ids: string[]; p_from: string; p_to: string }
        Returns: Json
      }
      report_vat_purchases: { Args: { p_company_id: string; p_month: string }; Returns: Json }
      report_vat_sales: { Args: { p_company_id: string; p_month: string }; Returns: Json }
      report_wht_certificates: {
        Args: { p_company_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      report_wht_pnd: {
        Args: {
          p_company_id: string
          p_form: Database['public']['Enums']['wht_form']
          p_from: string
          p_to: string
        }
        Returns: Json
      }
      report_wht_received: {
        Args: { p_company_id: string; p_from: string; p_to: string }
        Returns: Json
      }
      retry_ocr_job: { Args: { p_job_id: string }; Returns: undefined }
      revoke_ocr_agent_key: { Args: { p_key_id: string }; Returns: undefined }
      revoke_share_link: { Args: { p_token: string }; Returns: undefined }
      run_depreciation: { Args: { p_company_id: string; p_month: string }; Returns: string }
      save_document: { Args: { p_doc: Json }; Returns: string }
      save_manual_journal: { Args: { p_payload: Json }; Returns: string }
      save_payment: { Args: { p_pay: Json }; Returns: string }
      set_cost_method: { Args: { p_company_id: string; p_method: string }; Returns: undefined }
      set_fiscal_year_start: { Args: { p_company_id: string; p_month: number }; Returns: undefined }
      set_ocr_threshold: { Args: { p_company_id: string; p_threshold: number }; Returns: undefined }
      set_received_wht_cert: {
        Args: {
          p_cert_date: string
          p_cert_no: string
          p_document_id: string
          p_payment_id: string
        }
        Returns: undefined
      }
      set_vat_claim: {
        Args: {
          p_claim_month: string
          p_document_id: string
          p_payment_id: string
          p_tax_invoice_date: string
          p_tax_invoice_no: string
        }
        Returns: undefined
      }
      simulate_manual_journal: { Args: { p_payload: Json }; Returns: Json }
      simulate_posting: { Args: { p_kind: string; p_payload: Json }; Returns: Json }
      stock_balance: { Args: { p_as_of: string; p_company_id: string }; Returns: Json }
      stock_card: { Args: { p_from: string; p_product_id: string; p_to: string }; Returns: Json }
      unfile_vat_return: { Args: { p_company_id: string; p_month: string }; Returns: undefined }
      unmatch_bank_line: { Args: { p_statement_line_id: string }; Returns: undefined }
      unregistered_asset_lines: { Args: { p_company_id: string }; Returns: Json }
      update_member_role: {
        Args: {
          p_company_id: string
          p_role: Database['public']['Enums']['member_role']
          p_user_id: string
        }
        Returns: undefined
      }
      vat_return_summary: { Args: { p_company_id: string; p_month: string }; Returns: Json }
      void_depreciation_run: { Args: { p_run_id: string }; Returns: undefined }
      void_document: { Args: { p_document_id: string; p_reason: string }; Returns: undefined }
      void_manual_journal: { Args: { p_id: string; p_reason: string }; Returns: undefined }
      void_payment: { Args: { p_payment_id: string; p_reason: string }; Returns: undefined }
      void_stock_adjustment: { Args: { p_id: string; p_reason: string }; Returns: undefined }
      wht_tax: {
        Args: {
          p_base: number
          p_condition: Database['public']['Enums']['wht_condition']
          p_rate: number
        }
        Returns: number
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
        | 'OUTPUT_VAT_DEFERRED'
        | 'INPUT_VAT_DEFERRED'
        | 'WHT_BORNE_EXPENSE'
        | 'COGS'
        | 'INVENTORY_ADJUSTMENT'
        | 'DEPRECIATION_EXPENSE'
        | 'ASSET_DISPOSAL_GAIN'
        | 'ASSET_DISPOSAL_LOSS'
      account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
      bank_account_kind: 'savings' | 'current' | 'fixed' | 'other'
      business_type: 'service' | 'trading' | 'manufacturing' | 'restaurant'
      contact_type: 'customer' | 'vendor' | 'both'
      date_era: 'BE' | 'CE'
      document_source: 'manual' | 'ocr'
      document_status: 'draft' | 'posted' | 'voided'
      document_type:
        | 'quotation'
        | 'invoice'
        | 'cash_sale'
        | 'credit_note'
        | 'debit_note'
        | 'purchase_order'
        | 'bill'
        | 'cash_purchase'
      entity_type: 'juristic' | 'individual'
      member_role: 'owner' | 'admin' | 'staff' | 'accountant' | 'viewer'
      ocr_job_source: 'web' | 'mobile' | 'folder' | 'api'
      ocr_job_status: 'queued' | 'processing' | 'done' | 'failed' | 'needs_review'
      payment_direction: 'received' | 'paid'
      product_kind: 'product' | 'service'
      product_vat_type: 'standard' | 'zero' | 'exempt'
      vat_mode: 'exclusive' | 'inclusive' | 'none'
      wht_condition: 'withhold' | 'pay_always' | 'pay_once'
      wht_form: 'pnd3' | 'pnd53'
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
        'OUTPUT_VAT_DEFERRED',
        'INPUT_VAT_DEFERRED',
        'WHT_BORNE_EXPENSE',
        'COGS',
        'INVENTORY_ADJUSTMENT',
        'DEPRECIATION_EXPENSE',
        'ASSET_DISPOSAL_GAIN',
        'ASSET_DISPOSAL_LOSS',
      ],
      account_type: ['asset', 'liability', 'equity', 'revenue', 'expense'],
      bank_account_kind: ['savings', 'current', 'fixed', 'other'],
      business_type: ['service', 'trading', 'manufacturing', 'restaurant'],
      contact_type: ['customer', 'vendor', 'both'],
      date_era: ['BE', 'CE'],
      document_source: ['manual', 'ocr'],
      document_status: ['draft', 'posted', 'voided'],
      document_type: [
        'quotation',
        'invoice',
        'cash_sale',
        'credit_note',
        'debit_note',
        'purchase_order',
        'bill',
        'cash_purchase',
      ],
      entity_type: ['juristic', 'individual'],
      member_role: ['owner', 'admin', 'staff', 'accountant', 'viewer'],
      ocr_job_source: ['web', 'mobile', 'folder', 'api'],
      ocr_job_status: ['queued', 'processing', 'done', 'failed', 'needs_review'],
      payment_direction: ['received', 'paid'],
      product_kind: ['product', 'service'],
      product_vat_type: ['standard', 'zero', 'exempt'],
      vat_mode: ['exclusive', 'inclusive', 'none'],
      wht_condition: ['withhold', 'pay_always', 'pay_once'],
      wht_form: ['pnd3', 'pnd53'],
    },
  },
} as const
