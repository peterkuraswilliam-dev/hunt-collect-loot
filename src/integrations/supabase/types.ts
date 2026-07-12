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
      asset_rarities: {
        Row: {
          color: string
          created_at: string
          is_system: boolean
          name: string
          slug: string
          sort_order: number
          weight: number
        }
        Insert: {
          color?: string
          created_at?: string
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
          weight?: number
        }
        Update: {
          color?: string
          created_at?: string
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
          weight?: number
        }
        Relationships: []
      }
      asset_tags: {
        Row: {
          asset_id: string
          created_at: string
          tag_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          tag_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_tags_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_types: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_system: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      assets: {
        Row: {
          asset_type_id: string | null
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
          status: string
          xp_per_hour: number
        }
        Insert: {
          asset_type_id?: string | null
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
          status?: string
          xp_per_hour?: number
        }
        Update: {
          asset_type_id?: string | null
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
          status?: string
          xp_per_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action: Json
          created_at: string
          enabled: boolean
          id: string
          module: string
          name: string
          trigger: Json
          updated_at: string
        }
        Insert: {
          action?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          name: string
          trigger?: Json
          updated_at?: string
        }
        Update: {
          action?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          name?: string
          trigger?: Json
          updated_at?: string
        }
        Relationships: []
      }
      catchup_xp_configs: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          ends_at: string | null
          id: string
          max_bonus: number
          min_level_difference: number
          multiplier: number
          name: string
          notes: string | null
          priority: number
          progression_type_id: string | null
          reference: string
          sort_order: number
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          max_bonus?: number
          min_level_difference?: number
          multiplier?: number
          name: string
          notes?: string | null
          priority?: number
          progression_type_id?: string | null
          reference?: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          max_bonus?: number
          min_level_difference?: number
          multiplier?: number
          name?: string
          notes?: string | null
          priority?: number
          progression_type_id?: string | null
          reference?: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catchup_xp_configs_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_assets: {
        Row: {
          added_at: string
          asset_id: string
          collection_id: string
        }
        Insert: {
          added_at?: string
          asset_id: string
          collection_id: string
        }
        Update: {
          added_at?: string
          asset_id?: string
          collection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_assets_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_sets_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "collection_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          bonuses: Json
          created_at: string
          description: string | null
          exclude_tags: string[]
          id: string
          image_url: string | null
          include_tags: string[]
          match_mode: string
          name: string
          realm_slug: string | null
          reward_credits: number
          reward_xp: number
          rewards: Json
          set_id: string | null
          slug: string
          sort_order: number
          status: string
          type: string | null
          updated_at: string
        }
        Insert: {
          bonuses?: Json
          created_at?: string
          description?: string | null
          exclude_tags?: string[]
          id?: string
          image_url?: string | null
          include_tags?: string[]
          match_mode?: string
          name: string
          realm_slug?: string | null
          reward_credits?: number
          reward_xp?: number
          rewards?: Json
          set_id?: string | null
          slug: string
          sort_order?: number
          status?: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          bonuses?: Json
          created_at?: string
          description?: string | null
          exclude_tags?: string[]
          id?: string
          image_url?: string | null
          include_tags?: string[]
          match_mode?: string
          name?: string
          realm_slug?: string | null
          reward_credits?: number
          reward_xp?: number
          rewards?: Json
          set_id?: string | null
          slug?: string
          sort_order?: number
          status?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "collection_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          icon: string | null
          id: string
          is_system: boolean
          name: string
          slug: string
          sort_order: number
          symbol: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          slug: string
          sort_order?: number
          symbol?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          slug?: string
          sort_order?: number
          symbol?: string | null
          updated_at?: string
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
        }
        Insert: {
          credits_multiplier?: number
          energy_production_multiplier?: number
          id?: number
          max_offline_hours?: number
          production_multiplier?: number
          spin_multiplier?: number
        }
        Update: {
          credits_multiplier?: number
          energy_production_multiplier?: number
          id?: number
          max_offline_hours?: number
          production_multiplier?: number
          spin_multiplier?: number
        }
        Relationships: []
      }
      feature_toggles: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_settings: {
        Row: {
          energy_max: number
          energy_regen_seconds: number
          id: number
        }
        Insert: {
          energy_max?: number
          energy_regen_seconds?: number
          id?: number
        }
        Update: {
          energy_max?: number
          energy_regen_seconds?: number
          id?: number
        }
        Relationships: []
      }
      games: {
        Row: {
          created_at: string
          description: string | null
          enabled_modules: string[]
          exclude_tags: string[]
          icon: string | null
          id: string
          include_tags: string[]
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled_modules?: string[]
          exclude_tags?: string[]
          icon?: string | null
          id?: string
          include_tags?: string[]
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled_modules?: string[]
          exclude_tags?: string[]
          icon?: string | null
          id?: string
          include_tags?: string[]
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          realm_id: string | null
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          realm_id?: string | null
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          realm_id?: string | null
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      mini_games: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          game_id: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          game_id?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          game_id?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mini_games_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      module_permissions: {
        Row: {
          capability: string
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          capability: string
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          capability?: string
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      module_settings: {
        Row: {
          module: string
          settings: Json
          updated_at: string
        }
        Insert: {
          module: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          module?: string
          settings?: Json
          updated_at?: string
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
          exclude_tags: string[]
          id: string
          image_url: string | null
          include_tags: string[]
          match_mode: string
          name: string
          price_credits: number
          slug: string
          sort_order: number
          status: string
          tier: string
        }
        Insert: {
          assets_per_pack?: number
          created_at?: string
          description?: string | null
          exclude_tags?: string[]
          id?: string
          image_url?: string | null
          include_tags?: string[]
          match_mode?: string
          name: string
          price_credits?: number
          slug: string
          sort_order?: number
          status?: string
          tier?: string
        }
        Update: {
          assets_per_pack?: number
          created_at?: string
          description?: string | null
          exclude_tags?: string[]
          id?: string
          image_url?: string | null
          include_tags?: string[]
          match_mode?: string
          name?: string
          price_credits?: number
          slug?: string
          sort_order?: number
          status?: string
          tier?: string
        }
        Relationships: []
      }
      prestige_configs: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          is_demo: boolean
          max_prestige_rank: number
          name: string
          notes: string | null
          prestige_color: string
          prestige_icon: string | null
          prestige_name: string
          progression_type_id: string | null
          required_max_level: number
          reset_stats: Json
          slug: string
          sort_order: number
          status: string
          updated_at: string
          xp_retention_pct: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          is_demo?: boolean
          max_prestige_rank?: number
          name: string
          notes?: string | null
          prestige_color?: string
          prestige_icon?: string | null
          prestige_name?: string
          progression_type_id?: string | null
          required_max_level?: number
          reset_stats?: Json
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
          xp_retention_pct?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          is_demo?: boolean
          max_prestige_rank?: number
          name?: string
          notes?: string | null
          prestige_color?: string
          prestige_icon?: string | null
          prestige_name?: string
          progression_type_id?: string | null
          required_max_level?: number
          reset_stats?: Json
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
          xp_retention_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "prestige_configs_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
        ]
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
      progression_demo_subjects: {
        Row: {
          avatar: string | null
          created_at: string
          id: string
          kind: string
          name: string
          notes: string | null
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          id?: string
          kind?: string
          name: string
          notes?: string | null
        }
        Update: {
          avatar?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      progression_entity_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      progression_levels: {
        Row: {
          color: string
          created_at: string
          description: string | null
          display_order: number
          hidden: boolean
          icon: string | null
          id: string
          is_demo: boolean
          level_number: number
          notes: string | null
          progression_type_id: string | null
          status: string
          title: string | null
          updated_at: string
          visible: boolean
          xp_from_previous: number
          xp_required: number
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          hidden?: boolean
          icon?: string | null
          id?: string
          is_demo?: boolean
          level_number: number
          notes?: string | null
          progression_type_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          visible?: boolean
          xp_from_previous?: number
          xp_required?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          display_order?: number
          hidden?: boolean
          icon?: string | null
          id?: string
          is_demo?: boolean
          level_number?: number
          notes?: string | null
          progression_type_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          visible?: boolean
          xp_from_previous?: number
          xp_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "progression_levels_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
        ]
      }
      progression_rules: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          ends_at: string | null
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          priority: number
          progression_type_id: string | null
          rule_type: Database["public"]["Enums"]["progression_rule_type"]
          slug: string
          starts_at: string | null
          status: string
          updated_at: string
          value: number
          xp_source_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          priority?: number
          progression_type_id?: string | null
          rule_type: Database["public"]["Enums"]["progression_rule_type"]
          slug: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          value?: number
          xp_source_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          priority?: number
          progression_type_id?: string | null
          rule_type?: Database["public"]["Enums"]["progression_rule_type"]
          slug?: string
          starts_at?: string | null
          status?: string
          updated_at?: string
          value?: number
          xp_source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progression_rules_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progression_rules_xp_source_id_fkey"
            columns: ["xp_source_id"]
            isOneToOne: false
            referencedRelation: "xp_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      progression_types: {
        Row: {
          allow_overflow_xp: boolean
          category: string
          color: string
          created_at: string
          default_curve_id: string | null
          description: string | null
          entity_type: string
          icon: string | null
          id: string
          is_demo: boolean
          max_level: number
          name: string
          slug: string
          sort_order: number
          starting_level: number
          starting_xp: number
          status: string
          updated_at: string
          visible: boolean
          xp_display_name: string
        }
        Insert: {
          allow_overflow_xp?: boolean
          category?: string
          color?: string
          created_at?: string
          default_curve_id?: string | null
          description?: string | null
          entity_type?: string
          icon?: string | null
          id?: string
          is_demo?: boolean
          max_level?: number
          name: string
          slug: string
          sort_order?: number
          starting_level?: number
          starting_xp?: number
          status?: string
          updated_at?: string
          visible?: boolean
          xp_display_name?: string
        }
        Update: {
          allow_overflow_xp?: boolean
          category?: string
          color?: string
          created_at?: string
          default_curve_id?: string | null
          description?: string | null
          entity_type?: string
          icon?: string | null
          id?: string
          is_demo?: boolean
          max_level?: number
          name?: string
          slug?: string
          sort_order?: number
          starting_level?: number
          starting_xp?: number
          status?: string
          updated_at?: string
          visible?: boolean
          xp_display_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "progression_types_default_curve_fk"
            columns: ["default_curve_id"]
            isOneToOne: false
            referencedRelation: "xp_curves"
            referencedColumns: ["id"]
          },
        ]
      }
      realms: {
        Row: {
          created_at: string
          description: string | null
          game_id: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          game_id?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          game_id?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "realms_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      rested_xp_configs: {
        Row: {
          bonus_multiplier: number
          created_at: string
          description: string | null
          enabled: boolean
          expires_after_hours: number | null
          id: string
          max_storage: number
          name: string
          notes: string | null
          offline_accumulation: boolean
          priority: number
          progression_type_id: string | null
          regen_rate_per_hour: number
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          bonus_multiplier?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          expires_after_hours?: number | null
          id?: string
          max_storage?: number
          name: string
          notes?: string | null
          offline_accumulation?: boolean
          priority?: number
          progression_type_id?: string | null
          regen_rate_per_hour?: number
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          bonus_multiplier?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          expires_after_hours?: number | null
          id?: string
          max_storage?: number
          name?: string
          notes?: string | null
          offline_accumulation?: boolean
          priority?: number
          progression_type_id?: string | null
          regen_rate_per_hour?: number
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rested_xp_configs_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          created_at: string
          detail: Json
          id: string
          reward_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          detail?: Json
          id?: string
          reward_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          detail?: Json
          id?: string
          reward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_activity_log_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_bundle_categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      reward_bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          display_order: number
          guaranteed: boolean
          id: string
          quantity_override: number | null
          reward_id: string
          weight: number
        }
        Insert: {
          bundle_id: string
          created_at?: string
          display_order?: number
          guaranteed?: boolean
          id?: string
          quantity_override?: number | null
          reward_id: string
          weight?: number
        }
        Update: {
          bundle_id?: string
          created_at?: string
          display_order?: number
          guaranteed?: boolean
          id?: string
          quantity_override?: number | null
          reward_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "reward_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "reward_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_bundle_items_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_bundles: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          enabled: boolean
          estimated_value: number
          icon: string | null
          id: string
          internal_id: string | null
          name: string
          rewards: Json
          slug: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          estimated_value?: number
          icon?: string | null
          id?: string
          internal_id?: string | null
          name: string
          rewards?: Json
          slug: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          estimated_value?: number
          icon?: string | null
          id?: string
          internal_id?: string | null
          name?: string
          rewards?: Json
          slug?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      reward_log: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          payload: Json
          ref_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          ref_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          ref_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_sources: {
        Row: {
          created_at: string
          enabled: boolean
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          enabled?: boolean
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      reward_types: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          enabled: boolean
          icon: string | null
          id: string
          internal_id: string | null
          is_system: boolean
          kind: string
          name: string
          slug: string
          sort_order: number
          stackable: boolean
          tradable: boolean
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          internal_id?: string | null
          is_system?: boolean
          kind: string
          name: string
          slug: string
          sort_order?: number
          stackable?: boolean
          tradable?: boolean
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          internal_id?: string | null
          is_system?: boolean
          kind?: string
          name?: string
          slug?: string
          sort_order?: number
          stackable?: boolean
          tradable?: boolean
        }
        Relationships: []
      }
      rewards: {
        Row: {
          archived_at: string | null
          asset_id: string | null
          asset_sync_status: string
          asset_synced_at: string | null
          asset_version: number
          category: string | null
          created_at: string
          description: string | null
          enabled: boolean
          icon: string | null
          id: string
          imported_at: string | null
          last_awarded_at: string | null
          name: string
          quantity: number
          rarity: string
          reward_type_id: string
          source_kind: string
          tags: string[]
          tier: string | null
          times_awarded: number
          times_claimed: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          asset_id?: string | null
          asset_sync_status?: string
          asset_synced_at?: string | null
          asset_version?: number
          category?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          imported_at?: string | null
          last_awarded_at?: string | null
          name: string
          quantity?: number
          rarity?: string
          reward_type_id: string
          source_kind?: string
          tags?: string[]
          tier?: string | null
          times_awarded?: number
          times_claimed?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          asset_id?: string | null
          asset_sync_status?: string
          asset_synced_at?: string | null
          asset_version?: number
          category?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          icon?: string | null
          id?: string
          imported_at?: string | null
          last_awarded_at?: string | null
          name?: string
          quantity?: number
          rarity?: string
          reward_type_id?: string
          source_kind?: string
          tags?: string[]
          tier?: string | null
          times_awarded?: number
          times_claimed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_reward_type_id_fkey"
            columns: ["reward_type_id"]
            isOneToOne: false
            referencedRelation: "reward_types"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          color: string
          created_at: string
          description: string | null
          ends_at: string | null
          icon: string | null
          id: string
          is_demo: boolean
          name: string
          notes: string | null
          progression_type_ids: string[]
          slug: string
          sort_order: number
          starts_at: string | null
          status: string
          updated_at: string
          visible: boolean
          xp_modifier: number
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          icon?: string | null
          id?: string
          is_demo?: boolean
          name: string
          notes?: string | null
          progression_type_ids?: string[]
          slug: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          updated_at?: string
          visible?: boolean
          xp_modifier?: number
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          icon?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string | null
          progression_type_ids?: string[]
          slug?: string
          sort_order?: number
          starts_at?: string | null
          status?: string
          updated_at?: string
          visible?: boolean
          xp_modifier?: number
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
          spin_id: string | null
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
          spin_id?: string | null
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
          spin_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "spin_rewards_spin_id_fkey"
            columns: ["spin_id"]
            isOneToOne: false
            referencedRelation: "spins"
            referencedColumns: ["id"]
          },
        ]
      }
      spins: {
        Row: {
          cooldown_seconds: number
          created_at: string
          daily_limit: number
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          status: string
        }
        Insert: {
          cooldown_seconds?: number
          created_at?: string
          daily_limit?: number
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          status?: string
        }
        Update: {
          cooldown_seconds?: number
          created_at?: string
          daily_limit?: number
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          status?: string
        }
        Relationships: []
      }
      subject_prestige: {
        Row: {
          created_at: string
          current_rank: number
          id: string
          last_prestige_at: string | null
          prestige_config_id: string | null
          progression_type_id: string
          subject_id: string
          total_prestiges: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_rank?: number
          id?: string
          last_prestige_at?: string | null
          prestige_config_id?: string | null
          progression_type_id: string
          subject_id: string
          total_prestiges?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_rank?: number
          id?: string
          last_prestige_at?: string | null
          prestige_config_id?: string | null
          progression_type_id?: string
          subject_id?: string
          total_prestiges?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_prestige_prestige_config_id_fkey"
            columns: ["prestige_config_id"]
            isOneToOne: false
            referencedRelation: "prestige_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_prestige_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_prestige_history: {
        Row: {
          created_at: string
          from_rank: number
          id: string
          note: string | null
          prestige_config_id: string | null
          progression_type_id: string
          subject_id: string
          to_rank: number
          xp_before: number
          xp_retained: number
        }
        Insert: {
          created_at?: string
          from_rank: number
          id?: string
          note?: string | null
          prestige_config_id?: string | null
          progression_type_id: string
          subject_id: string
          to_rank: number
          xp_before?: number
          xp_retained?: number
        }
        Update: {
          created_at?: string
          from_rank?: number
          id?: string
          note?: string | null
          prestige_config_id?: string | null
          progression_type_id?: string
          subject_id?: string
          to_rank?: number
          xp_before?: number
          xp_retained?: number
        }
        Relationships: []
      }
      subject_progression: {
        Row: {
          created_at: string
          current_level: number
          current_xp: number
          id: string
          last_awarded_amount: number | null
          last_awarded_at: string | null
          last_level_up_at: string | null
          lifetime_xp: number
          progression_type_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_level?: number
          current_xp?: number
          id?: string
          last_awarded_amount?: number | null
          last_awarded_at?: string | null
          last_level_up_at?: string | null
          lifetime_xp?: number
          progression_type_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_level?: number
          current_xp?: number
          id?: string
          last_awarded_amount?: number | null
          last_awarded_at?: string | null
          last_level_up_at?: string | null
          lifetime_xp?: number
          progression_type_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_progression_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_rested_xp: {
        Row: {
          created_at: string
          id: string
          last_accrued_at: string
          last_used_at: string | null
          notes: string | null
          progression_type_id: string
          stored_xp: number
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_accrued_at?: string
          last_used_at?: string | null
          notes?: string | null
          progression_type_id: string
          stored_xp?: number
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_accrued_at?: string
          last_used_at?: string | null
          notes?: string | null
          progression_type_id?: string
          stored_xp?: number
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_rested_xp_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_season_history: {
        Row: {
          archived_at: string
          events_count: number
          final_xp: number
          id: string
          progression_type_id: string
          season_id: string
          snapshot: Json
          subject_id: string
        }
        Insert: {
          archived_at?: string
          events_count?: number
          final_xp?: number
          id?: string
          progression_type_id: string
          season_id: string
          snapshot?: Json
          subject_id: string
        }
        Update: {
          archived_at?: string
          events_count?: number
          final_xp?: number
          id?: string
          progression_type_id?: string
          season_id?: string
          snapshot?: Json
          subject_id?: string
        }
        Relationships: []
      }
      subject_season_progress: {
        Row: {
          created_at: string
          events_count: number
          id: string
          last_awarded_at: string | null
          progression_type_id: string
          season_id: string
          season_xp: number
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          events_count?: number
          id?: string
          last_awarded_at?: string | null
          progression_type_id: string
          season_id: string
          season_xp?: number
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          events_count?: number
          id?: string
          last_awarded_at?: string | null
          progression_type_id?: string
          season_id?: string
          season_xp?: number
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_season_progress_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_season_progress_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
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
      xp_award_log: {
        Row: {
          amount: number
          created_at: string
          id: string
          level_after: number
          level_before: number
          leveled_up: boolean
          note: string | null
          progression_type_id: string
          subject_id: string
          xp_after: number
          xp_before: number
          xp_source_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          level_after: number
          level_before: number
          leveled_up?: boolean
          note?: string | null
          progression_type_id: string
          subject_id: string
          xp_after: number
          xp_before: number
          xp_source_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          level_after?: number
          level_before?: number
          leveled_up?: boolean
          note?: string | null
          progression_type_id?: string
          subject_id?: string
          xp_after?: number
          xp_before?: number
          xp_source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_award_log_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_award_log_xp_source_id_fkey"
            columns: ["xp_source_id"]
            isOneToOne: false
            referencedRelation: "xp_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_curve_levels: {
        Row: {
          curve_id: string
          level: number
          xp_required: number
          xp_total: number
        }
        Insert: {
          curve_id: string
          level: number
          xp_required: number
          xp_total: number
        }
        Update: {
          curve_id?: string
          level?: number
          xp_required?: number
          xp_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_curve_levels_curve_id_fkey"
            columns: ["curve_id"]
            isOneToOne: false
            referencedRelation: "xp_curves"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_curves: {
        Row: {
          base_xp: number
          created_at: string
          decimal_precision: number
          description: string | null
          growth_factor: number
          growth_multiplier: number
          growth_type: string
          id: string
          max_level: number
          name: string
          notes: string | null
          slug: string
          smoothing: boolean
          starting_xp: number
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          base_xp?: number
          created_at?: string
          decimal_precision?: number
          description?: string | null
          growth_factor?: number
          growth_multiplier?: number
          growth_type?: string
          id?: string
          max_level?: number
          name: string
          notes?: string | null
          slug: string
          smoothing?: boolean
          starting_xp?: number
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          base_xp?: number
          created_at?: string
          decimal_precision?: number
          description?: string | null
          growth_factor?: number
          growth_multiplier?: number
          growth_type?: string
          id?: string
          max_level?: number
          name?: string
          notes?: string | null
          slug?: string
          smoothing?: boolean
          starting_xp?: number
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          error_message: string | null
          event_type: Database["public"]["Enums"]["xp_event_type"]
          id: string
          level_after: number
          level_before: number
          levels_gained: number
          metadata: Json
          note: string | null
          progression_type_id: string
          replay_of: string | null
          status: Database["public"]["Enums"]["xp_event_status"]
          subject_id: string
          xp_after: number
          xp_before: number
          xp_source_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          error_message?: string | null
          event_type: Database["public"]["Enums"]["xp_event_type"]
          id?: string
          level_after?: number
          level_before?: number
          levels_gained?: number
          metadata?: Json
          note?: string | null
          progression_type_id: string
          replay_of?: string | null
          status?: Database["public"]["Enums"]["xp_event_status"]
          subject_id: string
          xp_after?: number
          xp_before?: number
          xp_source_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          error_message?: string | null
          event_type?: Database["public"]["Enums"]["xp_event_type"]
          id?: string
          level_after?: number
          level_before?: number
          levels_gained?: number
          metadata?: Json
          note?: string | null
          progression_type_id?: string
          replay_of?: string | null
          status?: Database["public"]["Enums"]["xp_event_status"]
          subject_id?: string
          xp_after?: number
          xp_before?: number
          xp_source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_replay_of_fkey"
            columns: ["replay_of"]
            isOneToOne: false
            referencedRelation: "xp_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "xp_events_xp_source_id_fkey"
            columns: ["xp_source_id"]
            isOneToOne: false
            referencedRelation: "xp_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_multipliers: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          name: string
          priority: number
          slug: string
          sort_order: number
          stackable: boolean
          starts_at: string | null
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          name: string
          priority?: number
          slug: string
          sort_order?: number
          stackable?: boolean
          starts_at?: string | null
          status?: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          name?: string
          priority?: number
          slug?: string
          sort_order?: number
          stackable?: boolean
          starts_at?: string | null
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      xp_source_categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          label: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          label: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          label?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      xp_sources: {
        Row: {
          base_xp: number
          category: string
          color: string
          cooldown_seconds: number
          created_at: string
          daily_cap: number | null
          description: string | null
          display_order: number
          enabled: boolean
          hidden: boolean
          icon: string | null
          id: string
          is_demo: boolean
          max_level: number | null
          max_xp_per_action: number | null
          min_level: number
          name: string
          notes: string | null
          progression_type_id: string | null
          scaling_enabled: boolean
          slug: string
          sort_order: number
          status: string
          updated_at: string
          visible: boolean
          weekly_cap: number | null
        }
        Insert: {
          base_xp?: number
          category?: string
          color?: string
          cooldown_seconds?: number
          created_at?: string
          daily_cap?: number | null
          description?: string | null
          display_order?: number
          enabled?: boolean
          hidden?: boolean
          icon?: string | null
          id?: string
          is_demo?: boolean
          max_level?: number | null
          max_xp_per_action?: number | null
          min_level?: number
          name: string
          notes?: string | null
          progression_type_id?: string | null
          scaling_enabled?: boolean
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
          visible?: boolean
          weekly_cap?: number | null
        }
        Update: {
          base_xp?: number
          category?: string
          color?: string
          cooldown_seconds?: number
          created_at?: string
          daily_cap?: number | null
          description?: string | null
          display_order?: number
          enabled?: boolean
          hidden?: boolean
          icon?: string | null
          id?: string
          is_demo?: boolean
          max_level?: number | null
          max_xp_per_action?: number | null
          min_level?: number
          name?: string
          notes?: string | null
          progression_type_id?: string | null
          scaling_enabled?: boolean
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
          visible?: boolean
          weekly_cap?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "xp_sources_progression_type_id_fkey"
            columns: ["progression_type_id"]
            isOneToOne: false
            referencedRelation: "progression_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_automation_rules: {
        Args: { p_asset_id: string }
        Returns: undefined
      }
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
      award_xp: {
        Args: {
          p_amount: number
          p_note?: string
          p_source_id: string
          p_subject: string
          p_type_id: string
        }
        Returns: Json
      }
      bulk_update_rewards: {
        Args: { p_patch: Json; p_reward_ids: string[] }
        Returns: Json
      }
      claim_collection_bonus: {
        Args: { p_collection_id: string; p_threshold: number; p_user: string }
        Returns: Json
      }
      clone_reward: { Args: { p_reward_id: string }; Returns: string }
      collect_production: { Args: { p_user: string }; Returns: Json }
      compute_effective_xp:
        | {
            Args: { p_amount: number; p_source_id: string; p_type_id: string }
            Returns: number
          }
        | {
            Args: {
              p_amount: number
              p_source_id: string
              p_subject?: string
              p_type_id: string
            }
            Returns: number
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_assets_as_rewards: {
        Args: {
          p_asset_ids: string[]
          p_keep_linked?: boolean
          p_mode?: string
          p_reward_type_id: string
        }
        Returns: Json
      }
      open_pack: { Args: { p_pack_id: string; p_user: string }; Returns: Json }
      pick_pack_asset: {
        Args: { p_pack_id: string }
        Returns: {
          asset_type_id: string | null
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
          status: string
          xp_per_hour: number
        }
        SetofOptions: {
          from: "*"
          to: "assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prestige_advance: {
        Args: { p_subject: string; p_type_id: string }
        Returns: Json
      }
      progression_level_for_xp: {
        Args: { p_type_id: string; p_xp: number }
        Returns: number
      }
      progression_next_level_xp: {
        Args: { p_current_level: number; p_type_id: string }
        Returns: number
      }
      rebuild_xp_curve_levels: { Args: { p_curve_id: string }; Returns: number }
      recompute_all_collections: { Args: never; Returns: undefined }
      recompute_collection: {
        Args: { p_collection_id: string }
        Returns: number
      }
      replay_xp_event: { Args: { p_event_id: string }; Returns: Json }
      resync_linked_rewards: {
        Args: { p_reward_ids?: string[] }
        Returns: Json
      }
      spin_wheel: { Args: { p_user: string }; Returns: Json }
      submit_xp_event: {
        Args: {
          p_amount: number
          p_metadata?: Json
          p_note?: string
          p_source_id: string
          p_subject: string
          p_type_id: string
        }
        Returns: Json
      }
      sync_reward_from_asset: { Args: { p_reward_id: string }; Returns: Json }
      xp_to_level: {
        Args: { p_curve_id: string; p_total_xp: number }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "business_owner"
      progression_rule_type:
        | "global_multiplier"
        | "type_multiplier"
        | "source_multiplier"
        | "level_requirement"
        | "daily_xp_limit"
        | "weekly_xp_limit"
        | "min_level"
        | "max_level"
      rarity: "common" | "rare" | "epic" | "legendary"
      tile_reward_type: "credits" | "xp" | "asset" | "pack" | "empty"
      xp_event_status: "processed" | "failed" | "replayed"
      xp_event_type: "xp_awarded" | "xp_removed" | "level_up" | "multi_level_up"
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
      app_role: ["admin", "moderator", "user", "business_owner"],
      progression_rule_type: [
        "global_multiplier",
        "type_multiplier",
        "source_multiplier",
        "level_requirement",
        "daily_xp_limit",
        "weekly_xp_limit",
        "min_level",
        "max_level",
      ],
      rarity: ["common", "rare", "epic", "legendary"],
      tile_reward_type: ["credits", "xp", "asset", "pack", "empty"],
      xp_event_status: ["processed", "failed", "replayed"],
      xp_event_type: ["xp_awarded", "xp_removed", "level_up", "multi_level_up"],
    },
  },
} as const
