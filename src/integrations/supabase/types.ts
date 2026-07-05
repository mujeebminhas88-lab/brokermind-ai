export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          document_code: string
          firm_id: string | null
          id: string
          payload: Json
          tax_year: number | null
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          document_code: string
          firm_id?: string | null
          id?: string
          payload?: Json
          tax_year?: number | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          document_code?: string
          firm_id?: string | null
          id?: string
          payload?: Json
          tax_year?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "underwriting_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_document_code_fkey"
            columns: ["document_code"]
            isOneToOne: false
            referencedRelation: "document_registry"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "application_documents_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          action_type: string | null
          application_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          firm_id: string | null
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string
        }
        Insert: {
          action: string
          action_type?: string | null
          application_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          firm_id?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string
        }
        Update: {
          action?: string
          action_type?: string | null
          application_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          firm_id?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "underwriting_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_settings: {
        Row: {
          broker_email: string | null
          broker_name: string | null
          brokerage_name: string | null
          created_at: string
          direct_phone: string | null
          firm_id: string | null
          licence_number: string | null
          logo_url: string | null
          mailing_address: string | null
          phone: string | null
          provinces: string[]
          signature: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          broker_email?: string | null
          broker_name?: string | null
          brokerage_name?: string | null
          created_at?: string
          direct_phone?: string | null
          firm_id?: string | null
          licence_number?: string | null
          logo_url?: string | null
          mailing_address?: string | null
          phone?: string | null
          provinces?: string[]
          signature?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          broker_email?: string | null
          broker_name?: string | null
          brokerage_name?: string | null
          created_at?: string
          direct_phone?: string | null
          firm_id?: string | null
          licence_number?: string | null
          logo_url?: string | null
          mailing_address?: string | null
          phone?: string | null
          provinces?: string[]
          signature?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_settings_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      communications_log: {
        Row: {
          application_id: string | null
          body: string | null
          channel: string
          contact: string | null
          created_at: string
          direction: string
          firm_id: string | null
          id: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          body?: string | null
          channel: string
          contact?: string | null
          created_at?: string
          direction?: string
          firm_id?: string | null
          id?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          application_id?: string | null
          body?: string | null
          channel?: string
          contact?: string | null
          created_at?: string
          direction?: string
          firm_id?: string | null
          id?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communications_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "underwriting_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_log_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_alerts: {
        Row: {
          alert_code: string
          application_id: string | null
          created_at: string
          details: Json
          document_code: string | null
          firm_id: string | null
          id: string
          message: string
          resolved: boolean
          severity: string
          updated_at: string
        }
        Insert: {
          alert_code: string
          application_id?: string | null
          created_at?: string
          details?: Json
          document_code?: string | null
          firm_id?: string | null
          id?: string
          message: string
          resolved?: boolean
          severity?: string
          updated_at?: string
        }
        Update: {
          alert_code?: string
          application_id?: string | null
          created_at?: string
          details?: Json
          document_code?: string | null
          firm_id?: string | null
          id?: string
          message?: string
          resolved?: boolean
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_alerts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "underwriting_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_alerts_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_flags: {
        Row: {
          application_id: string | null
          code: string
          created_at: string
          firm_id: string | null
          id: string
          message: string
          note: string | null
          severity: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          code: string
          created_at?: string
          firm_id?: string | null
          id?: string
          message: string
          note?: string | null
          severity?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          application_id?: string | null
          code?: string
          created_at?: string
          firm_id?: string | null
          id?: string
          message?: string
          note?: string | null
          severity?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_flags_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "underwriting_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_flags_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      conditions: {
        Row: {
          application_id: string
          created_at: string
          description: string | null
          due_date: string | null
          firm_id: string | null
          id: string
          label: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          firm_id?: string | null
          id?: string
          label: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          firm_id?: string | null
          id?: string
          label?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conditions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "underwriting_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conditions_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      document_registry: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
          firm_id: string | null
          id: string
          label: string
          required_fields: Json
          updated_at: string
          validation_rules: Json
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description?: string | null
          firm_id?: string | null
          id?: string
          label: string
          required_fields?: Json
          updated_at?: string
          validation_rules?: Json
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          firm_id?: string | null
          id?: string
          label?: string
          required_fields?: Json
          updated_at?: string
          validation_rules?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_registry_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      file_notes: {
        Row: {
          application_id: string
          author_name: string | null
          body: string
          created_at: string
          firm_id: string | null
          id: string
          note_type: string
          user_id: string
        }
        Insert: {
          application_id: string
          author_name?: string | null
          body: string
          created_at?: string
          firm_id?: string | null
          id?: string
          note_type?: string
          user_id?: string
        }
        Update: {
          application_id?: string
          author_name?: string | null
          body?: string
          created_at?: string
          firm_id?: string | null
          id?: string
          note_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "underwriting_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_notes_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_members: {
        Row: {
          created_at: string
          firm_id: string
          id: string
          is_owner: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          firm_id: string
          id?: string
          is_owner?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          id?: string
          is_owner?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_members_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_status: {
        Row: {
          created_at: string
          firm_id: string | null
          id: string
          key_last4: string | null
          last_error: string | null
          last_tested_at: string | null
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          firm_id?: string | null
          id?: string
          key_last4?: string | null
          last_error?: string | null
          last_tested_at?: string | null
          provider: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          firm_id?: string | null
          id?: string
          key_last4?: string | null
          last_error?: string | null
          last_tested_at?: string | null
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_status_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          email_sent_at: string | null
          entity_id: string | null
          entity_type: string | null
          firm_id: string | null
          id: string
          read_at: string | null
          severity: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          email_sent_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          firm_id?: string | null
          id?: string
          read_at?: string | null
          severity?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          email_sent_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          firm_id?: string | null
          id?: string
          read_at?: string | null
          severity?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      parsed_documents: {
        Row: {
          application_id: string | null
          confidence: number
          created_at: string
          document_code: string
          firm_id: string | null
          id: string
          parsed_payload: Json
          source_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          confidence?: number
          created_at?: string
          document_code: string
          firm_id?: string | null
          id?: string
          parsed_payload?: Json
          source_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          application_id?: string | null
          confidence?: number
          created_at?: string
          document_code?: string
          firm_id?: string | null
          id?: string
          parsed_payload?: Json
          source_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parsed_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "underwriting_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsed_documents_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_holds: {
        Row: {
          application_id: string | null
          created_at: string
          expiry_date: string
          firm_id: string | null
          id: string
          lender: string
          notes: string | null
          product: string | null
          rate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          expiry_date: string
          firm_id?: string | null
          id?: string
          lender: string
          notes?: string | null
          product?: string | null
          rate: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          expiry_date?: string
          firm_id?: string | null
          id?: string
          lender?: string
          notes?: string | null
          product?: string | null
          rate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_holds_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "underwriting_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_holds_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      renewals: {
        Row: {
          application_id: string | null
          client_name: string | null
          created_at: string
          current_balance: number | null
          current_rate: number | null
          firm_id: string | null
          id: string
          last_contact_at: string | null
          lender: string
          maturity_date: string | null
          notes: string | null
          property_address: string | null
          renewal_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          client_name?: string | null
          created_at?: string
          current_balance?: number | null
          current_rate?: number | null
          firm_id?: string | null
          id?: string
          last_contact_at?: string | null
          lender: string
          maturity_date?: string | null
          notes?: string | null
          property_address?: string | null
          renewal_status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          application_id?: string | null
          client_name?: string | null
          created_at?: string
          current_balance?: number | null
          current_rate?: number | null
          firm_id?: string | null
          id?: string
          last_contact_at?: string | null
          lender?: string
          maturity_date?: string | null
          notes?: string | null
          property_address?: string | null
          renewal_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewals_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "underwriting_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewals_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      underwriting_applications: {
        Row: {
          aggregate_risk_score: number
          application_number: string
          balance_owing: number
          created_at: string
          deal_type: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          firm_id: string | null
          gds: number
          has_arrears: boolean
          id: string
          is_priority: boolean
          lender_name: string | null
          line_15000_total_income: number
          line_23600_net_income: number
          loan_amount: number
          property_address: string | null
          province: string | null
          review_status: Database["public"]["Enums"]["review_status"]
          tax_year: number
          taxpayer_name: string
          tds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aggregate_risk_score?: number
          application_number: string
          balance_owing?: number
          created_at?: string
          deal_type?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          firm_id?: string | null
          gds?: number
          has_arrears?: boolean
          id?: string
          is_priority?: boolean
          lender_name?: string | null
          line_15000_total_income?: number
          line_23600_net_income?: number
          loan_amount?: number
          property_address?: string | null
          province?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          tax_year: number
          taxpayer_name: string
          tds?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          aggregate_risk_score?: number
          application_number?: string
          balance_owing?: number
          created_at?: string
          deal_type?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          firm_id?: string | null
          gds?: number
          has_arrears?: boolean
          id?: string
          is_priority?: boolean
          lender_name?: string | null
          line_15000_total_income?: number
          line_23600_net_income?: number
          loan_amount?: number
          property_address?: string | null
          province?: string | null
          review_status?: Database["public"]["Enums"]["review_status"]
          tax_year?: number
          taxpayer_name?: string
          tds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "underwriting_applications_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_amortization: number
          default_export: string
          default_heating_cost: number
          default_term: number
          email_notifications: boolean
          firm_id: string | null
          in_app_notifications: boolean
          notif_condition_overdue: boolean
          notif_new_flag: boolean
          notif_rate_hold: boolean
          notif_renewal_approaching: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_amortization?: number
          default_export?: string
          default_heating_cost?: number
          default_term?: number
          email_notifications?: boolean
          firm_id?: string | null
          in_app_notifications?: boolean
          notif_condition_overdue?: boolean
          notif_new_flag?: boolean
          notif_rate_hold?: boolean
          notif_renewal_approaching?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          default_amortization?: number
          default_export?: string
          default_heating_cost?: number
          default_term?: number
          email_notifications?: boolean
          firm_id?: string | null
          in_app_notifications?: boolean
          notif_condition_overdue?: boolean
          notif_new_flag?: boolean
          notif_rate_hold?: boolean
          notif_renewal_approaching?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          firm_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          firm_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_firm_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_firm_member: { Args: { _firm_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      employment_type: "Salaried" | "Self-Employed" | "Incorporated"
      review_status:
        | "Draft"
        | "In Review"
        | "Ready for Review"
        | "Approved"
        | "Declined"
        | "New"
        | "Documents Requested"
        | "Conditions Issued"
        | "Funded"
        | "Withdrawn"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      employment_type: ["Salaried", "Self-Employed", "Incorporated"],
      review_status: [
        "Draft",
        "In Review",
        "Ready for Review",
        "Approved",
        "Declined",
        "New",
        "Documents Requested",
        "Conditions Issued",
        "Funded",
        "Withdrawn",
      ],
    },
  },
} as const
