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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      applications: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          lender: string | null
          loan_amount: number | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          lender?: string | null
          loan_amount?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          lender?: string | null
          loan_amount?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_records: {
        Row: {
          agent_id: string | null
          call_type: string
          created_at: string
          duration_seconds: number
          id: string
          lead_id: string
          outcome: string | null
          sentiment: string | null
          status: string
          summary: string | null
        }
        Insert: {
          agent_id?: string | null
          call_type?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          lead_id: string
          outcome?: string | null
          sentiment?: string | null
          status?: string
          summary?: string | null
        }
        Update: {
          agent_id?: string | null
          call_type?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          lead_id?: string
          outcome?: string | null
          sentiment?: string | null
          status?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_records_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
          product: Database["public"]["Enums"]["product_type"]
          source: string
          spend: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
          product: Database["public"]["Enums"]["product_type"]
          source: string
          spend?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
          product?: Database["public"]["Enums"]["product_type"]
          source?: string
          spend?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          state: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          state?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string | null
          id: string
          lead_id: string
          status: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name?: string | null
          id?: string
          lead_id: string
          status?: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string | null
          id?: string
          lead_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          config: Json
          connected_at: string | null
          display_name: string
          id: string
          organization_id: string | null
          provider: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          connected_at?: string | null
          display_name: string
          id?: string
          organization_id?: string | null
          provider: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          connected_at?: string | null
          display_name?: string
          id?: string
          organization_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activities: {
        Row: {
          activity_type: string
          actor: string
          created_at: string
          description: string
          id: string
          lead_id: string
        }
        Insert: {
          activity_type: string
          actor?: string
          created_at?: string
          description: string
          id?: string
          lead_id: string
        }
        Update: {
          activity_type?: string
          actor?: string
          created_at?: string
          description?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_status: string
          assigned_to: string | null
          automation_status: string
          call_consent: boolean
          call_status: string
          campaign: string | null
          city: string | null
          coverage_type: string | null
          created_at: string
          current_insurer: string | null
          customer_id: string | null
          do_not_contact: boolean
          down_payment: number | null
          email: string | null
          employment_type: string | null
          fuel_type: string | null
          full_name: string
          id: string
          last_contacted_at: string | null
          lead_score: number
          lead_uid: string
          loan_amount: number | null
          monthly_income: number | null
          next_follow_up_at: string | null
          organization_id: string | null
          phone: string
          policy_expiry: string | null
          priority: string
          product: Database["public"]["Enums"]["product_type"]
          source: string
          state: string | null
          status: string
          tenure_months: number | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string | null
          vehicle_variant: string | null
          vehicle_year: number | null
          whatsapp_consent: boolean
          whatsapp_status: string
        }
        Insert: {
          ai_status?: string
          assigned_to?: string | null
          automation_status?: string
          call_consent?: boolean
          call_status?: string
          campaign?: string | null
          city?: string | null
          coverage_type?: string | null
          created_at?: string
          current_insurer?: string | null
          customer_id?: string | null
          do_not_contact?: boolean
          down_payment?: number | null
          email?: string | null
          employment_type?: string | null
          fuel_type?: string | null
          full_name: string
          id?: string
          last_contacted_at?: string | null
          lead_score?: number
          lead_uid: string
          loan_amount?: number | null
          monthly_income?: number | null
          next_follow_up_at?: string | null
          organization_id?: string | null
          phone: string
          policy_expiry?: string | null
          priority?: string
          product: Database["public"]["Enums"]["product_type"]
          source?: string
          state?: string | null
          status?: string
          tenure_months?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_variant?: string | null
          vehicle_year?: number | null
          whatsapp_consent?: boolean
          whatsapp_status?: string
        }
        Update: {
          ai_status?: string
          assigned_to?: string | null
          automation_status?: string
          call_consent?: boolean
          call_status?: string
          campaign?: string | null
          city?: string | null
          coverage_type?: string | null
          created_at?: string
          current_insurer?: string | null
          customer_id?: string | null
          do_not_contact?: boolean
          down_payment?: number | null
          email?: string | null
          employment_type?: string | null
          fuel_type?: string | null
          full_name?: string
          id?: string
          last_contacted_at?: string | null
          lead_score?: number
          lead_uid?: string
          loan_amount?: number | null
          monthly_income?: number | null
          next_follow_up_at?: string | null
          organization_id?: string | null
          phone?: string
          policy_expiry?: string | null
          priority?: string
          product?: Database["public"]["Enums"]["product_type"]
          source?: string
          state?: string | null
          status?: string
          tenure_months?: number | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_reg?: string | null
          vehicle_variant?: string | null
          vehicle_year?: number | null
          whatsapp_consent?: boolean
          whatsapp_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          lead_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          lead_id: string | null
          method: string | null
          organization_id: string | null
          paid_at: string | null
          status: string
          transaction_ref: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          lead_id?: string | null
          method?: string | null
          organization_id?: string | null
          paid_at?: string | null
          status?: string
          transaction_ref?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          lead_id?: string | null
          method?: string | null
          organization_id?: string | null
          paid_at?: string | null
          status?: string
          transaction_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          title: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          title?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          title?: string | null
        }
        Relationships: []
      }
      quotations: {
        Row: {
          coverage: string | null
          created_at: string
          created_by: string | null
          emi: number | null
          id: string
          idv: number | null
          interest_rate: number | null
          lead_id: string
          loan_amount: number | null
          notes: string | null
          premium: number | null
          product: Database["public"]["Enums"]["product_type"]
          provider: string | null
          status: string
          tenure_months: number | null
          valid_until: string | null
        }
        Insert: {
          coverage?: string | null
          created_at?: string
          created_by?: string | null
          emi?: number | null
          id?: string
          idv?: number | null
          interest_rate?: number | null
          lead_id: string
          loan_amount?: number | null
          notes?: string | null
          premium?: number | null
          product: Database["public"]["Enums"]["product_type"]
          provider?: string | null
          status?: string
          tenure_months?: number | null
          valid_until?: string | null
        }
        Update: {
          coverage?: string | null
          created_at?: string
          created_by?: string | null
          emi?: number | null
          id?: string
          idv?: number | null
          interest_rate?: number | null
          lead_id?: string
          loan_amount?: number | null
          notes?: string | null
          premium?: number | null
          product?: Database["public"]["Enums"]["product_type"]
          provider?: string | null
          status?: string
          tenure_months?: number | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          due_date: string | null
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string | null
          priority: string
          status: string
          task_type: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          body: string
          created_at: string
          direction: string
          id: string
          lead_id: string
          sender_type: string
          status: string
        }
        Insert: {
          body: string
          created_at?: string
          direction: string
          id?: string
          lead_id: string
          sender_type?: string
          status?: string
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          id?: string
          lead_id?: string
          sender_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of: { Args: { _org: string }; Returns: boolean }
      my_organization_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "sales_manager"
        | "sales_agent"
        | "telecaller"
      product_type: "insurance" | "loan"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "super_admin",
        "admin",
        "sales_manager",
        "sales_agent",
        "telecaller",
      ],
      product_type: ["insurance", "loan"],
    },
  },
} as const
