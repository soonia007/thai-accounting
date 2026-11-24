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
          vat_type: Database['public']['Enums']['product_vat_type']
          wht_amount: number
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
          vat_type?: Database['public']['Enums']['product_vat_type']
          wht_amount?: number
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
          vat_type?: Database['public']['Enums']['product_vat_type']
          wht_amount?: number
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
          ref_document_id: string | null
          reference: string | null
          source: Database['public']['Enums']['document_source']
          status: Database['public']['Enums']['document_status']
          subtotal: number
          total: number
          type: Database['public']['Enums']['document_type']
          updated_at: string
          vat_deferred_total: number
          vat_mode: Database['public']['Enums']['vat_mode']
          vat_rate: number
          vat_total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
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
          ref_document_id?: string | null
          reference?: string | null
          source?: Database['public']['Enums']['document_source']
          status?: Database['public']['Enums']['document_status']
          subtotal?: number
          total?: number
          type: Database['public']['Enums']['document_type']
          updated_at?: string
          vat_deferred_total?: number
          vat_mode?: Database['public']['Enums']['vat_mode']
          vat_rate?: number
          vat_total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
          ref_document_id?: string | null
          reference?: string | null
          source?: Database['public']['Enums']['document_source']
          status?: Database['public']['Enums']['document_status']
          subtotal?: number
          total?: number
          type?: Database['public']['Enums']['document_type']
          updated_at?: string
          vat_deferred_total?: number
          vat_mode?: Database['public']['Enums']['vat_mode']
          vat_rate?: number
          vat_total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
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
      journal_entries: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          document_id: string | null
          entry_date: string
          id: string
          payment_id: string | null
          reverses_entry_id: string | null
        }
        ComputedFields: never
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          entry_date: string
          id?: string
          payment_id?: string | null
          reverses_entry_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          document_id?: string | null
          entry_date?: string
          id?: string
          payment_id?: string | null
          reverses_entry_id?: string | null
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
            foreignKeyName: 'journal_entries_reverses_entry_id_fkey'
            columns: ['reverses_entry_id']
            isOneToOne: false
            referencedRelation: 'journal_entries'
            referencedColumns: ['id']
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
          reference: string | null
          status: Database['public']['Enums']['document_status']
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          wht_amount: number
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
          reference?: string | null
          status?: Database['public']['Enums']['document_status']
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wht_amount?: number
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
          reference?: string | null
          status?: Database['public']['Enums']['document_status']
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          wht_amount?: number
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
          sale_price: number | null
          unit: string | null
          updated_at: string
          vat_type: Database['public']['Enums']['product_vat_type']
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
          sale_price?: number | null
          unit?: string | null
          updated_at?: string
          vat_type?: Database['public']['Enums']['product_vat_type']
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
          sale_price?: number | null
          unit?: string | null
          updated_at?: string
          vat_type?: Database['public']['Enums']['product_vat_type']
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
      create_share_link: {
        Args: { p_document_id?: string; p_expires_at?: string; p_payment_id?: string }
        Returns: string
      }
      document_balance: { Args: { p_document_id: string }; Returns: Json }
      get_shared_document: { Args: { p_token: string }; Returns: Json }
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
      post_document: { Args: { p_document_id: string }; Returns: Json }
      post_payment: { Args: { p_payment_id: string }; Returns: Json }
      print_document: { Args: { p_document_id?: string; p_payment_id?: string }; Returns: Json }
      remove_member: { Args: { p_company_id: string; p_user_id: string }; Returns: undefined }
      revoke_share_link: { Args: { p_token: string }; Returns: undefined }
      save_document: { Args: { p_doc: Json }; Returns: string }
      save_payment: { Args: { p_pay: Json }; Returns: string }
      simulate_posting: { Args: { p_kind: string; p_payload: Json }; Returns: Json }
      update_member_role: {
        Args: {
          p_company_id: string
          p_role: Database['public']['Enums']['member_role']
          p_user_id: string
        }
        Returns: undefined
      }
      void_document: { Args: { p_document_id: string; p_reason: string }; Returns: undefined }
      void_payment: { Args: { p_payment_id: string; p_reason: string }; Returns: undefined }
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
      payment_direction: 'received' | 'paid'
      product_kind: 'product' | 'service'
      product_vat_type: 'standard' | 'zero' | 'exempt'
      vat_mode: 'exclusive' | 'inclusive' | 'none'
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
      payment_direction: ['received', 'paid'],
      product_kind: ['product', 'service'],
      product_vat_type: ['standard', 'zero', 'exempt'],
      vat_mode: ['exclusive', 'inclusive', 'none'],
    },
  },
} as const
