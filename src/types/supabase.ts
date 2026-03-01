export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4";
  };
  public: {
    Tables: {
      boards: {
        Row: {
          created_at: string;
          id: string;
          node_order: Json;
          owner_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          node_order?: Json;
          owner_id: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          node_order?: Json;
          owner_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      edges: {
        Row: {
          board_id: string;
          created_at: string;
          deleted_at: string | null;
          direction: string;
          id: string;
          label: string | null;
          line_style: string;
          source_id: string;
          target_id: string;
        };
        Insert: {
          board_id: string;
          created_at?: string;
          deleted_at?: string | null;
          direction?: string;
          id?: string;
          label?: string | null;
          line_style?: string;
          source_id: string;
          target_id: string;
        };
        Update: {
          board_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          direction?: string;
          id?: string;
          label?: string | null;
          line_style?: string;
          source_id?: string;
          target_id?: string;
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
          user_id: string;
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
      nodes: {
        Row: {
          board_id: string;
          color: string | null;
          content: Json | null;
          created_at: string;
          deleted_at: string | null;
          height: number;
          id: string;
          type: string;
          updated_at: string;
          width: number;
          x: number;
          y: number;
        };
        Insert: {
          board_id: string;
          color?: string | null;
          content?: Json | null;
          created_at?: string;
          deleted_at?: string | null;
          height: number;
          id?: string;
          type: string;
          updated_at?: string;
          width: number;
          x: number;
          y: number;
        };
        Update: {
          board_id?: string;
          color?: string | null;
          content?: Json | null;
          created_at?: string;
          deleted_at?: string | null;
          height?: number;
          id?: string;
          type?: string;
          updated_at?: string;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
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
  public: {
    Enums: {},
  },
} as const;
