export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      boards: {
        Row: {
          created_at: string;
          id: string;
          node_order: Json;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          node_order?: Json;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          node_order?: Json;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      edges: {
        Row: {
          board_id: string;
          change_status: string | null;
          changeset_id: string | null;
          color: string | null;
          created_at: string;
          deleted_at: string | null;
          direction: string;
          from_anchor: string | null;
          from_node: string;
          id: string;
          label: string | null;
          line_style: string;
          to_anchor: string | null;
          to_node: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          board_id: string;
          change_status?: string | null;
          changeset_id?: string | null;
          color?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          direction?: string;
          from_anchor?: string | null;
          from_node: string;
          id?: string;
          label?: string | null;
          line_style?: string;
          to_anchor?: string | null;
          to_node: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          board_id?: string;
          change_status?: string | null;
          changeset_id?: string | null;
          color?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          direction?: string;
          from_anchor?: string | null;
          from_node?: string;
          id?: string;
          label?: string | null;
          line_style?: string;
          to_anchor?: string | null;
          to_node?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "edges_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          asset_id: string;
          board_id: string;
          created_at: string;
          deleted_at: string | null;
          file_name: string;
          id: string;
          image_path: string | null;
          mime_type: string;
          original_height: number | null;
          original_width: number | null;
          size_bytes: number;
          updated_at: string;
        };
        Insert: {
          asset_id: string;
          board_id: string;
          created_at?: string;
          deleted_at?: string | null;
          file_name: string;
          id?: string;
          image_path?: string | null;
          mime_type: string;
          original_height?: number | null;
          original_width?: number | null;
          size_bytes?: number;
          updated_at?: string;
        };
        Update: {
          asset_id?: string;
          board_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          file_name?: string;
          id?: string;
          image_path?: string | null;
          mime_type?: string;
          original_height?: number | null;
          original_width?: number | null;
          size_bytes?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: {
          group_id: string;
          node_id: string;
        };
        Insert: {
          group_id: string;
          node_id: string;
        };
        Update: {
          group_id?: string;
          node_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_node_id_fkey";
            columns: ["node_id"];
            isOneToOne: false;
            referencedRelation: "nodes";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          board_id: string;
          color: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          label: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          board_id: string;
          color?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          label?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          board_id?: string;
          color?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          label?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      inbox_items: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          source_title: string | null;
          source_url: string | null;
          target_board_id: string | null;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          id?: string;
          source_title?: string | null;
          source_url?: string | null;
          target_board_id?: string | null;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          source_title?: string | null;
          source_url?: string | null;
          target_board_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inbox_items_target_board_id_fkey";
            columns: ["target_board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      nodes: {
        Row: {
          board_id: string;
          change_status: string | null;
          changeset_id: string | null;
          color: string | null;
          content: Json | null;
          created_at: string;
          deleted_at: string | null;
          height: number;
          id: string;
          source_title: string | null;
          source_url: string | null;
          type: string;
          updated_at: string;
          user_id: string;
          width: number;
          x: number;
          y: number;
        };
        Insert: {
          board_id: string;
          change_status?: string | null;
          changeset_id?: string | null;
          color?: string | null;
          content?: Json | null;
          created_at?: string;
          deleted_at?: string | null;
          height: number;
          id?: string;
          source_title?: string | null;
          source_url?: string | null;
          type: string;
          updated_at?: string;
          user_id?: string;
          width: number;
          x: number;
          y: number;
        };
        Update: {
          board_id?: string;
          change_status?: string | null;
          changeset_id?: string | null;
          color?: string | null;
          content?: Json | null;
          created_at?: string;
          deleted_at?: string | null;
          height?: number;
          id?: string;
          source_title?: string | null;
          source_url?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string;
          width?: number;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "nodes_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      oauth_authorization_codes: {
        Row: {
          client_id: string;
          code: string;
          code_challenge: string;
          code_challenge_method: string;
          created_at: string | null;
          encrypted_supabase_token: string;
          expires_at: string;
          redirect_uri: string;
          user_id: string;
        };
        Insert: {
          client_id: string;
          code: string;
          code_challenge: string;
          code_challenge_method?: string;
          created_at?: string | null;
          encrypted_supabase_token: string;
          expires_at: string;
          redirect_uri: string;
          user_id: string;
        };
        Update: {
          client_id?: string;
          code?: string;
          code_challenge?: string;
          code_challenge_method?: string;
          created_at?: string | null;
          encrypted_supabase_token?: string;
          expires_at?: string;
          redirect_uri?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_authorization_codes_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "oauth_clients";
            referencedColumns: ["client_id"];
          },
        ];
      };
      oauth_clients: {
        Row: {
          client_id: string;
          client_name: string | null;
          created_at: string | null;
          last_used_at: string | null;
          redirect_uris: string[];
        };
        Insert: {
          client_id?: string;
          client_name?: string | null;
          created_at?: string | null;
          last_used_at?: string | null;
          redirect_uris: string[];
        };
        Update: {
          client_id?: string;
          client_name?: string | null;
          created_at?: string | null;
          last_used_at?: string | null;
          redirect_uris?: string[];
        };
        Relationships: [];
      };
      oauth_sessions: {
        Row: {
          client_id: string;
          code_challenge: string;
          code_challenge_method: string;
          created_at: string | null;
          expires_at: string;
          redirect_uri: string;
          session_key: string;
          state: string | null;
          supabase_code_verifier: string | null;
        };
        Insert: {
          client_id: string;
          code_challenge: string;
          code_challenge_method?: string;
          created_at?: string | null;
          expires_at: string;
          redirect_uri: string;
          session_key: string;
          state?: string | null;
          supabase_code_verifier?: string | null;
        };
        Update: {
          client_id?: string;
          code_challenge?: string;
          code_challenge_method?: string;
          created_at?: string | null;
          expires_at?: string;
          redirect_uri?: string;
          session_key?: string;
          state?: string | null;
          supabase_code_verifier?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "oauth_sessions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "oauth_clients";
            referencedColumns: ["client_id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          created_at: string | null;
          endpoint: string;
          id: number;
          key: string;
        };
        Insert: {
          created_at?: string | null;
          endpoint: string;
          id?: number;
          key: string;
        };
        Update: {
          created_at?: string | null;
          endpoint?: string;
          id?: number;
          key?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_rate_limit: {
        Args: {
          p_endpoint: string;
          p_key: string;
          p_max_requests: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      sync_group_members: {
        Args: { p_group_ids: string[]; p_members: Json };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
