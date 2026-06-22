export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface Asset {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  rarity: Rarity;
  collection_id: string | null;
  sort_order: number;
  energy_per_hour: number;
  credits_per_hour: number;
  xp_per_hour: number;
}

export interface CollectionBonus {
  threshold: number;
  type: "energy_max" | "realm_unlock" | string;
  value: number;
  spin_tokens?: number;
  label?: string;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  reward_credits: number;
  reward_xp: number;
  sort_order: number;
  bonuses: CollectionBonus[];
  realm_slug: string | null;
}

export interface Pack {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  tier: string;
  price_credits: number;
  assets_per_pack: number;
  sort_order: number;
}

export interface UserStats {
  user_id: string;
  credits: number;
  xp: number;
  level: number;
  energy: number;
  energy_updated_at: string;
  packs_opened: number;
  collections_completed: number;
  joined_at: string;
  spin_tokens: number;
  production_collected_at: string;
  bonus_energy_max: number;
}

export interface GameSettings {
  id: number;
  energy_max: number;
  energy_regen_seconds: number;
  dig_energy_cost: number;
  grid_size: number;
  xp_per_level: number;
  treasure_rewards: unknown;
}

export interface EconomyMultipliers {
  id: number;
  production_multiplier: number;
  credits_multiplier: number;
  xp_multiplier: number;
  energy_production_multiplier: number;
  spin_multiplier: number;
  max_offline_hours: number;
}

export interface SpinReward {
  id: string;
  label: string;
  kind: "credits" | "energy" | "xp" | "pack" | "asset";
  min_amount: number;
  max_amount: number;
  pack_slug: string | null;
  asset_rarity: string | null;
  weight: number;
  icon: string | null;
  sort_order: number;
  active: boolean;
}

export interface CollectionClaim {
  id: string;
  collection_id: string;
  threshold: number;
  claimed_at: string;
}

export type DigResult =
  | { type: "empty" }
  | { type: "credits"; amount: number }
  | { type: "xp"; amount: number }
  | { type: "asset"; asset: Asset }
  | { type: "pack"; pack: Pack }
  | { error: string };

export interface OpenPackResult {
  pack?: Pack;
  drops?: Asset[];
  error?: string;
}

export interface CollectProductionResult {
  credits: number;
  xp: number;
  energy: number;
  hours: number;
  error?: string;
}

export interface SpinResult {
  reward?: SpinReward;
  amount?: number;
  asset?: Asset | null;
  pack?: Pack | null;
  error?: string;
}
