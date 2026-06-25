import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type RewardType = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  is_system: boolean;
};

export type PackRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  tier: string;
  price_credits: number;
  assets_per_pack: number;
  sort_order: number;
  status: string;
  include_tags: string[];
  exclude_tags: string[];
  match_mode: "all" | "any";
};

export type SpinWheel = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  cooldown_seconds: number;
  daily_limit: number;
  status: string;
  sort_order: number;
};

export type SpinRewardRow = {
  id: string;
  spin_id: string | null;
  label: string;
  kind: string;
  min_amount: number;
  max_amount: number;
  pack_slug: string | null;
  asset_rarity: string | null;
  weight: number;
  icon: string | null;
  sort_order: number;
  active: boolean;
};

export type RewardBundle = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rewards: Array<{ kind: string; amount?: number; pack_slug?: string; asset_rarity?: string }>;
  status: string;
};

export type RewardSource = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  enabled: boolean;
  sort_order: number;
};

export type RewardLogRow = {
  id: string;
  user_id: string;
  source: string;
  kind: string;
  amount: number;
  ref_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

const opt = <T,>(key: unknown[], from: string, order = "sort_order"): ReturnType<typeof queryOptions<T[]>> =>
  queryOptions({
    queryKey: key,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await sb.from(from).select("*").order(order);
      if (error) throw error;
      return (data ?? []) as T[];
    },
    staleTime: 30_000,
  });

export const rewardTypesQuery = opt<RewardType>(["reward_types"], "reward_types");
export const packsAdminQuery = opt<PackRow>(["packs_admin"], "packs");
export const spinsQuery = opt<SpinWheel>(["spins"], "spins");
export const spinRewardsAllQuery = opt<SpinRewardRow>(["spin_rewards_all"], "spin_rewards");
export const rewardBundlesQuery = opt<RewardBundle>(["reward_bundles"], "reward_bundles", "name");
export const rewardSourcesQuery = opt<RewardSource>(["reward_sources"], "reward_sources");

export const rewardLogRecentQuery = queryOptions({
  queryKey: ["reward_log_recent"],
  queryFn: async (): Promise<RewardLogRow[]> => {
    const { data, error } = await sb
      .from("reward_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 15_000,
});

export const userPacksTotalsQuery = queryOptions({
  queryKey: ["user_packs_totals"],
  queryFn: async (): Promise<Array<{ pack_id: string; total: number }>> => {
    const { data, error } = await sb.from("user_packs").select("pack_id, quantity");
    if (error) throw error;
    const map = new Map<string, number>();
    for (const r of (data ?? []) as Array<{ pack_id: string; quantity: number }>) {
      map.set(r.pack_id, (map.get(r.pack_id) ?? 0) + r.quantity);
    }
    return Array.from(map.entries()).map(([pack_id, total]) => ({ pack_id, total }));
  },
  staleTime: 30_000,
});
