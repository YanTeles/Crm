// Arquivo gerado por scripts/db/gen-types.mjs — não editar manualmente.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: string;
          company_id: string | null;
          data: Json;
          entity_id: string | null;
          entity_type: string;
          id: number;
          occurred_at: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role: string;
          company_id?: string | null;
          data?: Json;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          occurred_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: string;
          company_id?: string | null;
          data?: Json;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          auto_distribution_enabled: boolean;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          slug: string;
          status: Database["public"]["Enums"]["company_status"];
          suspended_at: string | null;
          suspended_reason: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          auto_distribution_enabled?: boolean;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          slug: string;
          status?: Database["public"]["Enums"]["company_status"];
          suspended_at?: string | null;
          suspended_reason?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          auto_distribution_enabled?: boolean;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["company_status"];
          suspended_at?: string | null;
          suspended_reason?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      company_invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          company_id: string;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          revoked_at: string | null;
          revoked_by: string | null;
          role: Database["public"]["Enums"]["member_role"];
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          company_id: string;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          company_id?: string;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role?: Database["public"]["Enums"]["member_role"];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_invitations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_invitations_inviter_fk";
            columns: ["company_id", "invited_by"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
          {
            foreignKeyName: "company_invitations_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string;
          deactivated_at: string | null;
          deactivated_by: string | null;
          distribution_seq: number;
          id: string;
          joined_at: string;
          role: Database["public"]["Enums"]["member_role"];
          status: Database["public"]["Enums"]["member_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          distribution_seq?: never;
          id?: string;
          joined_at?: string;
          role: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          distribution_seq?: never;
          id?: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_deactivated_by_fkey";
            columns: ["deactivated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      custom_field_options: {
        Row: {
          company_id: string;
          created_at: string;
          field_id: string;
          field_type: Database["public"]["Enums"]["custom_field_type"];
          id: string;
          is_active: boolean;
          label: string;
          label_key: string | null;
          position: number;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          field_id: string;
          field_type?: Database["public"]["Enums"]["custom_field_type"];
          id?: string;
          is_active?: boolean;
          label: string;
          label_key?: never;
          position?: number;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          field_id?: string;
          field_type?: Database["public"]["Enums"]["custom_field_type"];
          id?: string;
          is_active?: boolean;
          label?: string;
          label_key?: never;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "custom_field_options_field_fk";
            columns: ["company_id", "field_id", "field_type"];
            isOneToOne: false;
            referencedRelation: "custom_fields";
            referencedColumns: ["company_id", "id", "field_type"];
          },
        ];
      };
      custom_fields: {
        Row: {
          company_id: string;
          created_at: string;
          field_type: Database["public"]["Enums"]["custom_field_type"];
          id: string;
          is_active: boolean;
          is_required: boolean;
          key: string;
          label: string;
          position: number;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          field_type: Database["public"]["Enums"]["custom_field_type"];
          id?: string;
          is_active?: boolean;
          is_required?: boolean;
          key: string;
          label: string;
          position?: number;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          field_type?: Database["public"]["Enums"]["custom_field_type"];
          id?: string;
          is_active?: boolean;
          is_required?: boolean;
          key?: string;
          label?: string;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "custom_fields_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_custom_values: {
        Row: {
          company_id: string;
          field_id: string;
          field_type: Database["public"]["Enums"]["custom_field_type"];
          lead_id: string;
          option_id: string | null;
          updated_at: string;
          updated_by: string;
          value_date: string | null;
          value_number: number | null;
          value_text: string | null;
        };
        Insert: {
          company_id: string;
          field_id: string;
          field_type: Database["public"]["Enums"]["custom_field_type"];
          lead_id: string;
          option_id?: string | null;
          updated_at?: string;
          updated_by: string;
          value_date?: string | null;
          value_number?: number | null;
          value_text?: string | null;
        };
        Update: {
          company_id?: string;
          field_id?: string;
          field_type?: Database["public"]["Enums"]["custom_field_type"];
          lead_id?: string;
          option_id?: string | null;
          updated_at?: string;
          updated_by?: string;
          value_date?: string | null;
          value_number?: number | null;
          value_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_custom_values_field_fk";
            columns: ["company_id", "field_id", "field_type"];
            isOneToOne: false;
            referencedRelation: "custom_fields";
            referencedColumns: ["company_id", "id", "field_type"];
          },
          {
            foreignKeyName: "lead_custom_values_lead_fk";
            columns: ["company_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "lead_custom_values_option_fk";
            columns: ["company_id", "field_id", "option_id"];
            isOneToOne: false;
            referencedRelation: "custom_field_options";
            referencedColumns: ["company_id", "field_id", "id"];
          },
          {
            foreignKeyName: "lead_custom_values_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_distribution_state: {
        Row: {
          company_id: string;
          last_assigned_to: string | null;
          last_member_seq: number | null;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          last_assigned_to?: string | null;
          last_member_seq?: number | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          last_assigned_to?: string | null;
          last_member_seq?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_distribution_state_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: true;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_distribution_state_last_assigned_to_fkey";
            columns: ["last_assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_events: {
        Row: {
          actor_id: string | null;
          amount: number | null;
          company_id: string;
          data: Json;
          event_type: Database["public"]["Enums"]["lead_event_type"];
          from_assignee: string | null;
          from_stage_id: string | null;
          id: number;
          lead_id: string;
          lost_reason_id: string | null;
          occurred_at: string;
          sale_id: string | null;
          to_assignee: string | null;
          to_stage_id: string | null;
        };
        Insert: {
          actor_id?: string | null;
          amount?: number | null;
          company_id: string;
          data?: Json;
          event_type: Database["public"]["Enums"]["lead_event_type"];
          from_assignee?: string | null;
          from_stage_id?: string | null;
          id?: never;
          lead_id: string;
          lost_reason_id?: string | null;
          occurred_at?: string;
          sale_id?: string | null;
          to_assignee?: string | null;
          to_stage_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          amount?: number | null;
          company_id?: string;
          data?: Json;
          event_type?: Database["public"]["Enums"]["lead_event_type"];
          from_assignee?: string | null;
          from_stage_id?: string | null;
          id?: never;
          lead_id?: string;
          lost_reason_id?: string | null;
          occurred_at?: string;
          sale_id?: string | null;
          to_assignee?: string | null;
          to_stage_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_events_from_assignee_fk";
            columns: ["company_id", "from_assignee"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
          {
            foreignKeyName: "lead_events_from_stage_fk";
            columns: ["company_id", "from_stage_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "lead_events_lead_fk";
            columns: ["company_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "lead_events_lost_reason_fk";
            columns: ["company_id", "lost_reason_id"];
            isOneToOne: false;
            referencedRelation: "lost_reasons";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "lead_events_sale_fk";
            columns: ["company_id", "sale_id"];
            isOneToOne: false;
            referencedRelation: "sales";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "lead_events_to_assignee_fk";
            columns: ["company_id", "to_assignee"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
          {
            foreignKeyName: "lead_events_to_stage_fk";
            columns: ["company_id", "to_stage_id"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      lead_interactions: {
        Row: {
          author_id: string;
          channel: Database["public"]["Enums"]["contact_channel"] | null;
          company_id: string;
          content: string;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["interaction_kind"];
          lead_id: string;
          occurred_at: string;
        };
        Insert: {
          author_id?: string;
          channel?: Database["public"]["Enums"]["contact_channel"] | null;
          company_id: string;
          content: string;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["interaction_kind"];
          lead_id: string;
          occurred_at?: string;
        };
        Update: {
          author_id?: string;
          channel?: Database["public"]["Enums"]["contact_channel"] | null;
          company_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["interaction_kind"];
          lead_id?: string;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_interactions_author_fk";
            columns: ["company_id", "author_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
          {
            foreignKeyName: "lead_interactions_lead_fk";
            columns: ["company_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
      lead_sources: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          name_key: string | null;
          position: number;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          name_key?: never;
          position?: number;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          name_key?: never;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_sources_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          assigned_to: string | null;
          client_request_id: string | null;
          closed_at: string | null;
          company_id: string;
          created_at: string;
          created_by: string;
          customer_company: string | null;
          email: string | null;
          id: string;
          lost_note: string | null;
          lost_reason_id: string | null;
          name: string;
          notes: string | null;
          outcome: Database["public"]["Enums"]["lead_outcome"];
          phone_normalized: string;
          phone_raw: string;
          row_version: number;
          search_text: string | null;
          source_id: string | null;
          stage_id: string;
          updated_at: string;
          won_amount: number | null;
          won_at: string | null;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          assigned_to?: string | null;
          client_request_id?: string | null;
          closed_at?: string | null;
          company_id: string;
          created_at?: string;
          created_by: string;
          customer_company?: string | null;
          email?: string | null;
          id?: string;
          lost_note?: string | null;
          lost_reason_id?: string | null;
          name: string;
          notes?: string | null;
          outcome?: Database["public"]["Enums"]["lead_outcome"];
          phone_normalized: string;
          phone_raw: string;
          row_version?: number;
          search_text?: never;
          source_id?: string | null;
          stage_id: string;
          updated_at?: string;
          won_amount?: number | null;
          won_at?: string | null;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          assigned_to?: string | null;
          client_request_id?: string | null;
          closed_at?: string | null;
          company_id?: string;
          created_at?: string;
          created_by?: string;
          customer_company?: string | null;
          email?: string | null;
          id?: string;
          lost_note?: string | null;
          lost_reason_id?: string | null;
          name?: string;
          notes?: string | null;
          outcome?: Database["public"]["Enums"]["lead_outcome"];
          phone_normalized?: string;
          phone_raw?: string;
          row_version?: number;
          search_text?: never;
          source_id?: string | null;
          stage_id?: string;
          updated_at?: string;
          won_amount?: number | null;
          won_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_assigned_fk";
            columns: ["company_id", "assigned_to"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
          {
            foreignKeyName: "leads_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_created_by_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
          {
            foreignKeyName: "leads_lost_reason_fk";
            columns: ["company_id", "lost_reason_id"];
            isOneToOne: false;
            referencedRelation: "lost_reasons";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "leads_source_fk";
            columns: ["company_id", "source_id"];
            isOneToOne: false;
            referencedRelation: "lead_sources";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "leads_stage_fk";
            columns: ["company_id", "stage_id", "outcome"];
            isOneToOne: false;
            referencedRelation: "pipeline_stages";
            referencedColumns: ["company_id", "id", "kind"];
          },
        ];
      };
      lost_reasons: {
        Row: {
          company_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          name_key: string | null;
          position: number;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          name_key?: never;
          position?: number;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          name_key?: never;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lost_reasons_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          company_id: string;
          created_at: string;
          data: Json;
          dedupe_key: string;
          dismissed_at: string | null;
          entity_id: string;
          entity_type: string;
          id: string;
          read_at: string | null;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          data?: Json;
          dedupe_key: string;
          dismissed_at?: string | null;
          entity_id: string;
          entity_type: string;
          id?: string;
          read_at?: string | null;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          data?: Json;
          dedupe_key?: string;
          dismissed_at?: string | null;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          read_at?: string | null;
          type?: Database["public"]["Enums"]["notification_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_fk";
            columns: ["company_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
        ];
      };
      pipeline_stages: {
        Row: {
          archived_at: string | null;
          company_id: string;
          created_at: string;
          id: string;
          is_default: boolean;
          kind: Database["public"]["Enums"]["lead_outcome"];
          name: string;
          name_key: string | null;
          position: number;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kind: Database["public"]["Enums"]["lead_outcome"];
          name: string;
          name_key?: never;
          position: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kind?: Database["public"]["Enums"]["lead_outcome"];
          name?: string;
          name_key?: never;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          note: string | null;
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          note?: string | null;
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          note?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_admins_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
        ];
      };
      reserved_slugs: {
        Row: {
          slug: string;
        };
        Insert: {
          slug: string;
        };
        Update: {
          slug?: string;
        };
        Relationships: [
        ];
      };
      sales: {
        Row: {
          amount: number;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_request_id: string | null;
          company_id: string;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          lead_id: string;
          row_version: number;
          seller_id: string;
          status: Database["public"]["Enums"]["sale_status"];
          updated_at: string;
        };
        Insert: {
          amount: number;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id?: string | null;
          company_id: string;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          description: string;
          id?: string;
          lead_id: string;
          row_version?: number;
          seller_id: string;
          status?: Database["public"]["Enums"]["sale_status"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id?: string | null;
          company_id?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          lead_id?: string;
          row_version?: number;
          seller_id?: string;
          status?: Database["public"]["Enums"]["sale_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sales_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_created_by_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
          {
            foreignKeyName: "sales_lead_fk";
            columns: ["company_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["company_id", "id"];
          },
          {
            foreignKeyName: "sales_seller_fk";
            columns: ["company_id", "seller_id"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
        ];
      };
      tasks: {
        Row: {
          assigned_to: string;
          company_id: string;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          due_at: string;
          id: string;
          lead_id: string | null;
          status: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_to: string;
          company_id: string;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          due_at: string;
          id?: string;
          lead_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string;
          company_id?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          due_at?: string;
          id?: string;
          lead_id?: string | null;
          status?: Database["public"]["Enums"]["task_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_fk";
            columns: ["company_id", "assigned_to"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
          {
            foreignKeyName: "tasks_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_created_by_fk";
            columns: ["company_id", "created_by"];
            isOneToOne: false;
            referencedRelation: "company_members";
            referencedColumns: ["company_id", "user_id"];
          },
          {
            foreignKeyName: "tasks_lead_fk";
            columns: ["company_id", "lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["company_id", "id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: {
        Args: {
          p_token: string | null;
        };
        Returns: string;
      };
      archive_stage: {
        Args: {
          p_stage_id: string | null;
          p_target_stage_id: string | null;
        };
        Returns: number;
      };
      assign_lead: {
        Args: {
          p_lead_id: string | null;
          p_assignee: string | null;
          p_expected_version?: number | null;
          p_transfer_tasks?: boolean | null;
        };
        Returns: number;
      };
      bootstrap_company: {
        Args: {
          p_name: string | null;
        };
        Returns: {
          company_id: string;
          slug: string;
        }[];
      };
      cancel_sale: {
        Args: {
          p_sale_id: string | null;
          p_reason: string | null;
          p_expected_version?: number | null;
        };
        Returns: number;
      };
      complete_sale: {
        Args: {
          p_sale_id: string | null;
          p_completed_at?: string | null;
          p_expected_version?: number | null;
        };
        Returns: number;
      };
      count_leads_by_member: {
        Args: {
          p_company_id: string | null;
        };
        Returns: {
          user_id: string;
          total: number;
          open_total: number;
        }[];
      };
      create_invitation: {
        Args: {
          p_company_id: string | null;
          p_email: string | null;
          p_role?: Database["public"]["Enums"]["member_role"] | null;
        };
        Returns: {
          invitation_id: string;
          token: string;
          expires_at: string;
        }[];
      };
      create_lead: {
        Args: {
          p_company_id: string | null;
          p_data: Json | null;
          p_custom_values?: Json | null;
          p_assignment_mode?: string | null;
          p_assignee?: string | null;
          p_client_request_id?: string | null;
        };
        Returns: Json;
      };
      create_sale: {
        Args: {
          p_lead_id: string | null;
          p_description: string | null;
          p_amount: number | null;
          p_status?: Database["public"]["Enums"]["sale_status"] | null;
          p_completed_at?: string | null;
          p_seller_id?: string | null;
          p_client_request_id?: string | null;
        };
        Returns: string;
      };
      create_stage: {
        Args: {
          p_company_id: string | null;
          p_name: string | null;
        };
        Returns: string;
      };
      find_possible_duplicates: {
        Args: {
          p_company_id: string | null;
          p_phone_normalized: string | null;
          p_exclude_lead_id?: string | null;
        };
        Returns: Json;
      };
      get_invitation: {
        Args: {
          p_token: string | null;
        };
        Returns: {
          company_name: string;
          role: Database["public"]["Enums"]["member_role"];
          expires_at: string;
          status: string;
        }[];
      };
      mark_lead_lost: {
        Args: {
          p_lead_id: string | null;
          p_reason_id: string | null;
          p_note?: string | null;
          p_expected_version?: number | null;
        };
        Returns: number;
      };
      mark_lead_won: {
        Args: {
          p_lead_id: string | null;
          p_amount: number | null;
          p_expected_version?: number | null;
        };
        Returns: number;
      };
      move_lead_stage: {
        Args: {
          p_lead_id: string | null;
          p_to_stage_id: string | null;
          p_expected_version?: number | null;
        };
        Returns: number;
      };
      platform_overview: {
        Args: {
          p_search?: string | null;
        };
        Returns: {
          company_id: string;
          name: string;
          slug: string;
          status: Database["public"]["Enums"]["company_status"];
          suspended_reason: string;
          created_at: string;
          active_members: number;
          leads_total: number;
        }[];
      };
      rename_stage: {
        Args: {
          p_stage_id: string | null;
          p_name: string | null;
        };
        Returns: undefined;
      };
      reopen_lead: {
        Args: {
          p_lead_id: string | null;
          p_to_stage_id?: string | null;
          p_expected_version?: number | null;
        };
        Returns: number;
      };
      reorder_stages: {
        Args: {
          p_company_id: string | null;
          p_stage_ids: string[] | null;
        };
        Returns: undefined;
      };
      report_by_seller: {
        Args: {
          p_company_id: string | null;
          p_from: string | null;
          p_to: string | null;
        };
        Returns: {
          user_id: string;
          full_name: string;
          member_status: Database["public"]["Enums"]["member_status"];
          revenue: number;
          sales_count: number;
          leads_assigned: number;
          leads_won: number;
        }[];
      };
      report_by_source: {
        Args: {
          p_company_id: string | null;
          p_from: string | null;
          p_to: string | null;
          p_seller_id?: string | null;
        };
        Returns: {
          source_id: string;
          source_name: string;
          leads_created: number;
          leads_won: number;
        }[];
      };
      report_lost_reasons: {
        Args: {
          p_company_id: string | null;
          p_from: string | null;
          p_to: string | null;
          p_seller_id?: string | null;
        };
        Returns: {
          reason_id: string;
          reason_name: string;
          total: number;
        }[];
      };
      report_monthly: {
        Args: {
          p_company_id: string | null;
          p_from: string | null;
          p_to: string | null;
          p_seller_id?: string | null;
        };
        Returns: {
          month: string;
          revenue: number;
          sales_count: number;
          leads_created: number;
          leads_won: number;
        }[];
      };
      report_summary: {
        Args: {
          p_company_id: string | null;
          p_from: string | null;
          p_to: string | null;
          p_seller_id?: string | null;
          p_source_id?: string | null;
          p_stage_id?: string | null;
        };
        Returns: Json;
      };
      revoke_invitation: {
        Args: {
          p_invitation_id: string | null;
        };
        Returns: undefined;
      };
      set_company_status: {
        Args: {
          p_company_id: string | null;
          p_status: Database["public"]["Enums"]["company_status"] | null;
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      set_default_stage: {
        Args: {
          p_stage_id: string | null;
        };
        Returns: undefined;
      };
      set_lead_archived: {
        Args: {
          p_lead_id: string | null;
          p_archived: boolean | null;
          p_expected_version?: number | null;
        };
        Returns: number;
      };
      set_member_role: {
        Args: {
          p_member_id: string | null;
          p_role: Database["public"]["Enums"]["member_role"] | null;
        };
        Returns: undefined;
      };
      set_member_status: {
        Args: {
          p_member_id: string | null;
          p_status: Database["public"]["Enums"]["member_status"] | null;
        };
        Returns: undefined;
      };
      transfer_member_leads: {
        Args: {
          p_company_id: string | null;
          p_from_user: string | null;
          p_to_user: string | null;
          p_transfer_tasks?: boolean | null;
        };
        Returns: number;
      };
      update_company_settings: {
        Args: {
          p_company_id: string | null;
          p_name: string | null;
          p_slug: string | null;
          p_timezone: string | null;
          p_auto_distribution: boolean | null;
        };
        Returns: string;
      };
      update_lead: {
        Args: {
          p_lead_id: string | null;
          p_data: Json | null;
          p_custom_values?: Json | null;
          p_expected_version?: number | null;
        };
        Returns: number;
      };
      update_sale: {
        Args: {
          p_sale_id: string | null;
          p_description: string | null;
          p_amount: number | null;
          p_completed_at?: string | null;
          p_seller_id?: string | null;
          p_expected_version?: number | null;
        };
        Returns: number;
      };
    };
    Enums: {
      company_status: "active" | "suspended";
      contact_channel: "phone" | "whatsapp" | "email" | "meeting" | "other";
      custom_field_type: "text" | "number" | "date" | "select";
      interaction_kind: "note" | "contact";
      lead_event_type: "created" | "updated" | "custom_fields_updated" | "assigned" | "stage_changed" | "won" | "lost" | "reopened" | "archived" | "unarchived" | "sale_created" | "sale_updated" | "sale_completed" | "sale_cancelled";
      lead_outcome: "open" | "won" | "lost";
      member_role: "admin" | "seller";
      member_status: "active" | "inactive";
      notification_type: "lead_assigned" | "task_assigned" | "task_overdue";
      sale_status: "pending" | "completed" | "cancelled";
      task_status: "pending" | "done";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
