export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface Asset {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  rarity: Rarity;
  collection_id: string | null;
  sort_order: number;
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
