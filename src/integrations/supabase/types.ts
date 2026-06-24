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
      auth_sessions: {
        Row: {
          ended_at: string | null
          id: string
          ip_address: string | null
          last_seen_at: string
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crew_assignments: {
        Row: {
          cost_rate: number
          created_at: string
          daily_rate: number
          end_date: string | null
          id: string
          project_id: string
          role: string
          section: string
          start_date: string | null
          user_id: string
        }
        Insert: {
          cost_rate?: number
          created_at?: string
          daily_rate?: number
          end_date?: string | null
          id?: string
          project_id: string
          role?: string
          section?: string
          start_date?: string | null
          user_id: string
        }
        Update: {
          cost_rate?: number
          created_at?: string
          daily_rate?: number
          end_date?: string | null
          id?: string
          project_id?: string
          role?: string
          section?: string
          start_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          brand: string | null
          category: string
          condition: string
          created_at: string
          daily_rate: number
          highlight: string | null
          id: string
          image_url: string | null
          internal_cost_per_day: number
          location_id: string | null
          manual_url: string | null
          model: string | null
          name: string
          notes: string | null
          organization_id: string
          purchase_date: string | null
          purchase_price: number | null
          quantity: number
          serial_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category?: string
          condition?: string
          created_at?: string
          daily_rate?: number
          highlight?: string | null
          id?: string
          image_url?: string | null
          internal_cost_per_day?: number
          location_id?: string | null
          manual_url?: string | null
          model?: string | null
          name: string
          notes?: string | null
          organization_id: string
          purchase_date?: string | null
          purchase_price?: number | null
          quantity?: number
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string
          condition?: string
          created_at?: string
          daily_rate?: number
          highlight?: string | null
          id?: string
          image_url?: string | null
          internal_cost_per_day?: number
          location_id?: string | null
          manual_url?: string | null
          model?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          purchase_date?: string | null
          purchase_price?: number | null
          quantity?: number
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_kits: {
        Row: {
          active: boolean
          created_at: string
          daily_rate: number
          description: string | null
          id: string
          location_id: string | null
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_rate?: number
          description?: string | null
          id?: string
          location_id?: string | null
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_rate?: number
          description?: string | null
          id?: string
          location_id?: string | null
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipment_maintenance: {
        Row: {
          cost: number
          created_at: string
          description: string | null
          equipment_id: string
          id: string
          next_due: string | null
          organization_id: string
          performed_at: string
          performed_by: string | null
          type: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description?: string | null
          equipment_id: string
          id?: string
          next_due?: string | null
          organization_id: string
          performed_at?: string
          performed_by?: string | null
          type?: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string | null
          equipment_id?: string
          id?: string
          next_due?: string | null
          organization_id?: string
          performed_at?: string
          performed_by?: string | null
          type?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          location_ids: string[]
          organization_id: string
          profile_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          location_ids?: string[]
          organization_id: string
          profile_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          location_ids?: string[]
          organization_id?: string
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_total: number | null
          quantity: number
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_total?: number | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_total?: number | null
          quantity?: number
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sequences: {
        Row: {
          last_number: number
          organization_id: string
          prefix: string
          year: number
        }
        Insert: {
          last_number?: number
          organization_id: string
          prefix?: string
          year: number
        }
        Update: {
          last_number?: number
          organization_id?: string
          prefix?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string | null
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          location_id: string | null
          notes: string | null
          organization_id: string
          project_id: string | null
          quote_project_id: string | null
          status: string
          subtotal: number
          terms: string | null
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          amount?: number
          client_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          location_id?: string | null
          notes?: string | null
          organization_id: string
          project_id?: string | null
          quote_project_id?: string | null
          status?: string
          subtotal?: number
          terms?: string | null
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          amount?: number
          client_id?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          project_id?: string | null
          quote_project_id?: string | null
          status?: string
          subtotal?: number
          terms?: string | null
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_project_id_fkey"
            columns: ["quote_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kit_items: {
        Row: {
          created_at: string
          equipment_id: string
          id: string
          kit_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          equipment_id: string
          id?: string
          kit_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          equipment_id?: string
          id?: string
          kit_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "kit_items_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "equipment_kits"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address: string | null
          bank_name: string | null
          created_at: string
          deleted_at: string | null
          iban: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          bank_name?: string | null
          created_at?: string
          deleted_at?: string | null
          iban?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          bank_name?: string | null
          created_at?: string
          deleted_at?: string | null
          iban?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json
          slug: string
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json
          slug: string
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          slug?: string
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      permission_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          organization_id: string
          permissions: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          organization_id: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          organization_id?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_size: number | null
          id: string
          organization_id: string
          original_name: string
          project_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_size?: number | null
          id?: string
          organization_id: string
          original_name: string
          project_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_size?: number | null
          id?: string
          organization_id?: string
          original_name?: string
          project_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_equipment: {
        Row: {
          cost_rate: number
          created_at: string
          equipment_id: string
          id: string
          notes: string | null
          pickup_date: string | null
          project_id: string
          quantity: number
          rate: number
          return_date: string | null
          section: string
        }
        Insert: {
          cost_rate?: number
          created_at?: string
          equipment_id: string
          id?: string
          notes?: string | null
          pickup_date?: string | null
          project_id: string
          quantity?: number
          rate?: number
          return_date?: string | null
          section?: string
        }
        Update: {
          cost_rate?: number
          created_at?: string
          equipment_id?: string
          id?: string
          notes?: string | null
          pickup_date?: string | null
          project_id?: string
          quantity?: number
          rate?: number
          return_date?: string | null
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_equipment_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_template_items: {
        Row: {
          cost_rate: number
          created_at: string
          crew_role: string | null
          daily_rate: number
          equipment_id: string | null
          id: string
          kind: string
          quantity: number
          section: string
          template_id: string
        }
        Insert: {
          cost_rate?: number
          created_at?: string
          crew_role?: string | null
          daily_rate?: number
          equipment_id?: string | null
          id?: string
          kind: string
          quantity?: number
          section?: string
          template_id: string
        }
        Update: {
          cost_rate?: number
          created_at?: string
          crew_role?: string | null
          daily_rate?: number
          equipment_id?: string | null
          id?: string
          kind?: string
          quantity?: number
          section?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          active: boolean
          created_at: string
          default_excluded: string[]
          default_included: string[]
          description: string | null
          event_type: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_excluded?: string[]
          default_included?: string[]
          description?: string | null
          event_type?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_excluded?: string[]
          default_included?: string[]
          description?: string | null
          event_type?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          event_type: string | null
          excluded_items: string[]
          id: string
          included_items: string[]
          location_id: string | null
          notes: string | null
          organization_id: string
          start_date: string | null
          status: string
          tier_gold_amount: number | null
          tier_silver_amount: number | null
          title: string
          total_amount: number
          updated_at: string
          venue: string | null
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          event_type?: string | null
          excluded_items?: string[]
          id?: string
          included_items?: string[]
          location_id?: string | null
          notes?: string | null
          organization_id: string
          start_date?: string | null
          status?: string
          tier_gold_amount?: number | null
          tier_silver_amount?: number | null
          title: string
          total_amount?: number
          updated_at?: string
          venue?: string | null
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          event_type?: string | null
          excluded_items?: string[]
          id?: string
          included_items?: string[]
          location_id?: string | null
          notes?: string | null
          organization_id?: string
          start_date?: string | null
          status?: string
          tier_gold_amount?: number | null
          tier_silver_amount?: number | null
          title?: string
          total_amount?: number
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sensitive_actions: {
        Row: {
          action_type: string
          category: string
          created_at: string
          description: string
          id: string
          location_id: string | null
          metadata: Json | null
          organization_id: string | null
          target_resource_id: string | null
          target_resource_type: string | null
          target_user_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          category: string
          created_at?: string
          description: string
          id?: string
          location_id?: string | null
          metadata?: Json | null
          organization_id?: string | null
          target_resource_id?: string | null
          target_resource_type?: string | null
          target_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          location_id?: string | null
          metadata?: Json | null
          organization_id?: string | null
          target_resource_id?: string | null
          target_resource_type?: string | null
          target_user_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sensitive_actions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sensitive_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          created_at: string
          id: string
          location_id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_profiles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          profile_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          profile_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          profile_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permission_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "permission_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      my_crew_assignments: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string | null
          project_id: string | null
          role: string | null
          section: string | null
          start_date: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string | null
          project_id?: string | null
          role?: string | null
          section?: string | null
          start_date?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string | null
          project_id?: string | null
          role?: string | null
          section?: string | null
          start_date?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crew_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invite: { Args: { _token: string }; Returns: string }
      cleanup_old_audit_data: { Args: never; Returns: undefined }
      convert_project_to_invoice: {
        Args: { _due_date?: string; _project_id: string }
        Returns: string
      }
      equipment_availability: {
        Args: {
          _equipment_id: string
          _exclude_pe_id?: string
          _from: string
          _to: string
        }
        Returns: number
      }
      equipment_booked_quantity: {
        Args: {
          _equipment_id: string
          _exclude_pe_id?: string
          _from: string
          _to: string
        }
        Returns: number
      }
      get_invite_by_token: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          email: string
          expires_at: string
          id: string
          organization_id: string
          organization_name: string
          profile_id: string
          profile_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      log_sensitive_action: {
        Args: {
          _action_type: string
          _category: string
          _description: string
          _location_id?: string
          _metadata?: Json
          _target_resource_id?: string
          _target_resource_type?: string
          _target_user_id?: string
        }
        Returns: string
      }
      next_invoice_number: { Args: { _org_id: string }; Returns: string }
      user_has_permission: {
        Args: { _permission: string; _user_id?: string }
        Returns: boolean
      }
      user_location_ids: { Args: { _user_id?: string }; Returns: string[] }
      user_organization_ids: { Args: { _user_id?: string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "team" | "client"
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
      app_role: ["admin", "team", "client"],
    },
  },
} as const
