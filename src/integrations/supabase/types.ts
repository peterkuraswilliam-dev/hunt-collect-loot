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
      activity_log: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      assets: {
        Row: {
          collection_id: string | null
          created_at: string
          credits_per_hour: number
          description: string | null
          energy_per_hour: number
          id: string
          image_url: string | null
          name: string
          rarity: Database["public"]["Enums"]["rarity"]
          slug: string
          sort_order: number
          xp_per_hour: number
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          credits_per_hour?: number
          description?: string | null
          energy_per_hour?: number
          id?: string
          image_url?: string | null
          name: string
          rarity?: Database["public"]["Enums"]["rarity"]
          slug: string
          sort_order?: number
          xp_per_hour?: number
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          credits_per_hour?: number
          description?: string | null
          energy_per_hour?: number
          id?: string
          image_url?: string | null
          name?: string
          rarity?: Database["public"]["Enums"]["rarity"]
          slug?: string
          sort_order?: number
          xp_per_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "assets_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          bonuses: Json
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          realm_slug: string | null
          reward_credits: number
          reward_xp: number
          slug: string
          sort_order: number
        }
        Insert: {
          bonuses?: Json
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          realm_slug?: string | null
          reward_credits?: number
          reward_xp?: number
          slug: string
          sort_order?: number
        }
        Update: {
          bonuses?: Json
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          realm_slug?: string | null
          reward_credits?: number
          reward_xp?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      economy_multipliers: {
        Row: {
          credits_multiplier: number
          energy_production_multiplier: number
          id: number
          max_offline_hours: number
          production_multiplier: number
          spin_multiplier: number
          xp_multiplier: number
        }
        Insert: {
          credits_multiplier?: number
          energy_production_multiplier?: number
          id?: number
          max_offline_hours?: number
          production_multiplier?: number
          spin_multiplier?: number
          xp_multiplier?: number
        }
        Update: {
          credits_multiplier?: number
          energy_production_multiplier?: number
          id?: number
          max_offline_hours?: number
          production_multiplier?: number
          spin_multiplier?: number
          xp_multiplier?: number
        }
        Relationships: []
      }
      game_settings: {
        Row: {
          dig_energy_cost: number
          energy_max: number
          energy_regen_seconds: number
          grid_size: number
          id: number
          treasure_rewards: Json
          xp_per_level: number
        }
        Insert: {
          dig_energy_cost?: number
          energy_max?: number
          energy_regen_seconds?: number
          grid_size?: number
          id?: number
          treasure_rewards?: Json
          xp_per_level?: number
        }
        Update: {
          dig_energy_cost?: number
          energy_max?: number
          energy_regen_seconds?: number
          grid_size?: number
          id?: number
          treasure_rewards?: Json
          xp_per_level?: number
        }
        Relationships: []
      }
      pack_drop_rates: {
        Row: {
          id: string
          pack_id: string
          rarity: Database["public"]["Enums"]["rarity"]
          weight: number
        }
        Insert: {
          id?: string
          pack_id: string
          rarity: Database["public"]["Enums"]["rarity"]
          weight: number
        }
        Update: {
          id?: string
          pack_id?: string
          rarity?: Database["public"]["Enums"]["rarity"]
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "pack_drop_rates_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      packs: {
        Row: {
          assets_per_pack: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price_credits: number
          slug: string
          sort_order: number
          tier: string
        }
        Insert: {
          assets_per_pack?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price_credits?: number
          slug: string
          sort_order?: number
          tier?: string
        }
        Update: {
          assets_per_pack?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price_credits?: number
          slug?: string
          sort_order?: number
          tier?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      spin_rewards: {
        Row: {
          active: boolean
          asset_rarity: string | null
          created_at: string
          icon: string | null
          id: string
          kind: string
          label: string
          max_amount: number
          min_amount: number
          pack_slug: string | null
          sort_order: number
          weight: number
        }
        Insert: {
          active?: boolean
          asset_rarity?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind: string
          label: string
          max_amount?: number
          min_amount?: number
          pack_slug?: string | null
          sort_order?: number
          weight?: number
        }
        Update: {
          active?: boolean
          asset_rarity?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: string
          label?: string
          max_amount?: number
          min_amount?: number
          pack_slug?: string | null
          sort_order?: number
          weight?: number
        }
        Relationships: []
      }
      user_collection_claims: {
        Row: {
          claimed_at: string
          collection_id: string
          id: string
          threshold: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          collection_id: string
          id?: string
          threshold: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          collection_id?: string
          id?: string
          threshold?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_collection_claims_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inventory: {
        Row: {
          asset_id: string
          first_obtained_at: string
          id: string
          quantity: number
          user_id: string
        }
        Insert: {
          asset_id: string
          first_obtained_at?: string
          id?: string
          quantity?: number
          user_id: string
        }
        Update: {
          asset_id?: string
          first_obtained_at?: string
          id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_packs: {
        Row: {
          id: string
          pack_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          id?: string
          pack_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          id?: string
          pack_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
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
      user_stats: {
        Row: {
          bonus_energy_max: number
          collections_completed: number
          credits: number
          energy: number
          energy_updated_at: string
          joined_at: string
          level: number
          packs_opened: number
          production_collected_at: string
          spin_tokens: number
          user_id: string
          xp: number
        }
        Insert: {
          bonus_energy_max?: number
          collections_completed?: number
          credits?: number
          energy?: number
          energy_updated_at?: string
          joined_at?: string
          level?: number
          packs_opened?: number
          production_collected_at?: string
          spin_tokens?: number
          user_id: string
          xp?: number
        }
        Update: {
          bonus_energy_max?: number
          collections_completed?: number
          credits?: number
          energy?: number
          energy_updated_at?: string
          joined_at?: string
          level?: number
          packs_opened?: number
          production_collected_at?: string
          spin_tokens?: number
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_energy_regen: {
        Args: { p_user: string }
        Returns: {
          bonus_energy_max: number
          collections_completed: number
          credits: number
          energy: number
          energy_updated_at: string
          joined_at: string
          level: number
          packs_opened: number
          production_collected_at: string
          spin_tokens: number
          user_id: string
          xp: number
        }
        SetofOptions: {
          from: "*"
          to: "user_stats"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_collection_bonus: {
        Args: { p_collection_id: string; p_threshold: number; p_user: string }
        Returns: Json
      }
      collect_production: { Args: { p_user: string }; Returns: Json }
      dig_tile: { Args: { p_user: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      open_pack: { Args: { p_pack_id: string; p_user: string }; Returns: Json }
      spin_wheel: { Args: { p_user: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      rarity: "common" | "rare" | "epic" | "legendary"
      tile_reward_type: "credits" | "xp" | "asset" | "pack" | "empty"
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
      rarity: ["common", "rare", "epic", "legendary"],
      tile_reward_type: ["credits", "xp", "asset", "pack", "empty"],
    },
  },
} as const
