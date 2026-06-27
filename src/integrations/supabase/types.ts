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
          id: string
          payload: Json
          tax_year: number | null
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          document_code: string
          id?: string
          payload?: Json
          tax_year?: number | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          document_code?: string
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
        ]
      }
      compliance_alerts: {
        Row: {
          alert_code: string
          application_id: string | null
          created_at: string
          details: Json
          document_code: string | null
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
        ]
      }
      document_registry: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string | null
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
          id?: string
          label?: string
          required_fields?: Json
          updated_at?: string
          validation_rules?: Json
        }
        Relationships: []
      }
      underwriting_applications: {
        Row: {
          aggregate_risk_score: number
          application_number: string
          balance_owing: number
          created_at: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          gds: number
          has_arrears: boolean
          id: string
          line_15000_total_income: number
          line_23600_net_income: number
          review_status: Database["public"]["Enums"]["review_status"]
          tax_year: number
          taxpayer_name: string
          tds: number
          updated_at: string
        }
        Insert: {
          aggregate_risk_score?: number
          application_number: string
          balance_owing?: number
          created_at?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          gds?: number
          has_arrears?: boolean
          id?: string
          line_15000_total_income?: number
          line_23600_net_income?: number
          review_status?: Database["public"]["Enums"]["review_status"]
          tax_year: number
          taxpayer_name: string
          tds?: number
          updated_at?: string
        }
        Update: {
          aggregate_risk_score?: number
          application_number?: string
          balance_owing?: number
          created_at?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          gds?: number
          has_arrears?: boolean
          id?: string
          line_15000_total_income?: number
          line_23600_net_income?: number
          review_status?: Database["public"]["Enums"]["review_status"]
          tax_year?: number
          taxpayer_name?: string
          tds?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      employment_type: "Salaried" | "Self-Employed" | "Incorporated"
      review_status:
        | "Draft"
        | "In Review"
        | "Ready for Review"
        | "Approved"
        | "Declined"
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
      employment_type: ["Salaried", "Self-Employed", "Incorporated"],
      review_status: [
        "Draft",
        "In Review",
        "Ready for Review",
        "Approved",
        "Declined",
      ],
    },
  },
} as const
