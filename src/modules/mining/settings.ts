import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export const MINING_MODULE_ID = "mining";
export const MINING_MODULE_VERSION = "1.0.0-beta";

export type MiningStatus = "enabled" | "disabled" | "maintenance" | "beta";

export interface MiningContentToggle {
  slug: string;
  label: string;
  enabled: boolean;
}

export interface MiningSettings {
  status: MiningStatus;
  navigation: { show_in_nav: boolean };
  gameplay: {
    auto_mining: boolean;
    critical_hits: boolean;
    random_events: boolean;
    pickaxe_upgrades: boolean;
    xp_rewards: boolean;
    coin_rewards: boolean;
    energy_system: boolean;
  };
  economy: {
    xp_multiplier: number;
    coin_multiplier: number;
    loot_multiplier: number;
    drop_rate_multiplier: number;
  };
  progression: {
    min_level: number;
    unlock_requirement: string | null;
    daily_play_limit: number | null;
  };
  content: {
    areas: Record<string, boolean>;
    rocks: Record<string, boolean>;
    pickaxes: Record<string, boolean>;
    loot: Record<string, boolean>;
    events: Record<string, boolean>;
  };
}

export const MINING_CONTENT_DEFAULTS = {
  areas: [
    { slug: "iron_cavern", label: "Iron Cavern" },
    { slug: "copper_ridge", label: "Copper Ridge" },
    { slug: "obsidian_depths", label: "Obsidian Depths" },
    { slug: "crystal_hollow", label: "Crystal Hollow" },
  ],
  rocks: [
    { slug: "stone", label: "Stone" },
    { slug: "iron_ore", label: "Iron Ore" },
    { slug: "copper_ore", label: "Copper Ore" },
    { slug: "gold_ore", label: "Gold Ore" },
    { slug: "obsidian", label: "Obsidian" },
    { slug: "geode", label: "Geode" },
  ],
  pickaxes: [
    { slug: "wooden_pick", label: "Wooden Pickaxe" },
    { slug: "iron_pick", label: "Iron Pickaxe" },
    { slug: "steel_pick", label: "Steel Pickaxe" },
    { slug: "mythril_pick", label: "Mythril Pickaxe" },
  ],
  loot: [
    { slug: "iron_ingot", label: "Iron Ingot" },
    { slug: "copper_ingot", label: "Copper Ingot" },
    { slug: "raw_gem", label: "Raw Gem" },
    { slug: "ancient_shard", label: "Ancient Shard" },
  ],
  events: [
    { slug: "vein_strike", label: "Vein Strike" },
    { slug: "cave_in", label: "Cave-In" },
    { slug: "wandering_merchant", label: "Wandering Merchant" },
    { slug: "lucky_geode", label: "Lucky Geode" },
  ],
} as const;

export function defaultMiningSettings(): MiningSettings {
  const bag = (arr: readonly { slug: string }[]) =>
    Object.fromEntries(arr.map((x) => [x.slug, true]));
  return {
    status: "beta",
    navigation: { show_in_nav: true },
    gameplay: {
      auto_mining: false,
      critical_hits: true,
      random_events: true,
      pickaxe_upgrades: true,
      xp_rewards: true,
      coin_rewards: true,
      energy_system: false,
    },
    economy: {
      xp_multiplier: 1,
      coin_multiplier: 1,
      loot_multiplier: 1,
      drop_rate_multiplier: 1,
    },
    progression: { min_level: 1, unlock_requirement: null, daily_play_limit: null },
    content: {
      areas: bag(MINING_CONTENT_DEFAULTS.areas),
      rocks: bag(MINING_CONTENT_DEFAULTS.rocks),
      pickaxes: bag(MINING_CONTENT_DEFAULTS.pickaxes),
      loot: bag(MINING_CONTENT_DEFAULTS.loot),
      events: bag(MINING_CONTENT_DEFAULTS.events),
    },
  };
}

export function mergeMiningSettings(raw: unknown): MiningSettings {
  const d = defaultMiningSettings();
  const s = (raw ?? {}) as Partial<MiningSettings>;
  return {
    status: (s.status as MiningStatus) ?? d.status,
    navigation: { ...d.navigation, ...(s.navigation ?? {}) },
    gameplay: { ...d.gameplay, ...(s.gameplay ?? {}) },
    economy: { ...d.economy, ...(s.economy ?? {}) },
    progression: { ...d.progression, ...(s.progression ?? {}) },
    content: {
      areas: { ...d.content.areas, ...(s.content?.areas ?? {}) },
      rocks: { ...d.content.rocks, ...(s.content?.rocks ?? {}) },
      pickaxes: { ...d.content.pickaxes, ...(s.content?.pickaxes ?? {}) },
      loot: { ...d.content.loot, ...(s.content?.loot ?? {}) },
      events: { ...d.content.events, ...(s.content?.events ?? {}) },
    },
  };
}

export const miningSettingsQuery = queryOptions({
  queryKey: ["module_settings", MINING_MODULE_ID],
  queryFn: async (): Promise<MiningSettings> => {
    const { data, error } = await sb
      .from("module_settings")
      .select("settings")
      .eq("module", MINING_MODULE_ID)
      .maybeSingle();
    if (error) throw error;
    return mergeMiningSettings(data?.settings);
  },
  staleTime: 15_000,
});

export async function saveMiningSettings(next: MiningSettings) {
  const { error } = await sb
    .from("module_settings")
    .upsert({ module: MINING_MODULE_ID, settings: next });
  if (error) throw error;
}
