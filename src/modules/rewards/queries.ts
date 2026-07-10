import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type RewardType = {
  id: string;
  slug: string;
  internal_id: string | null;
  name: string;
  kind: string;
  icon: string | null;
  description: string | null;
  color: string | null;
  stackable: boolean;
  tradable: boolean;
  enabled: boolean;
  sort_order: number;
  is_system: boolean;
};

export type Reward = {
  id: string;
  name: string;
  reward_type_id: string;
  description: string | null;
  icon: string | null;
  quantity: number;
  rarity: string;
  enabled: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
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

export type RewardBundle = {
  id: string;
  slug: string;
  internal_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  enabled: boolean;
  tags: string[];
  estimated_value: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type RewardBundleItem = {
  id: string;
  bundle_id: string;
  reward_id: string;
  quantity_override: number | null;
  guaranteed: boolean;
  weight: number;
  display_order: number;
};

export type RewardBundleCategory = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
};

export const rewardTypesQuery = queryOptions({
  queryKey: ["reward_types"],
  queryFn: async (): Promise<RewardType[]> => {
    const { data, error } = await sb.from("reward_types").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 30_000,
});

export const rewardsQuery = queryOptions({
  queryKey: ["rewards"],
  queryFn: async (): Promise<Reward[]> => {
    const { data, error } = await sb.from("rewards").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 30_000,
});

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

export const rewardBundlesQuery = queryOptions({
  queryKey: ["reward_bundles"],
  queryFn: async (): Promise<RewardBundle[]> => {
    const { data, error } = await sb.from("reward_bundles").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 30_000,
});

export const rewardBundleItemsQuery = (bundleId: string | null) =>
  queryOptions({
    queryKey: ["reward_bundle_items", bundleId],
    enabled: !!bundleId,
    queryFn: async (): Promise<RewardBundleItem[]> => {
      if (!bundleId) return [];
      const { data, error } = await sb
        .from("reward_bundle_items")
        .select("*")
        .eq("bundle_id", bundleId)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });

export const rewardBundleCategoriesQuery = queryOptions({
  queryKey: ["reward_bundle_categories"],
  queryFn: async (): Promise<RewardBundleCategory[]> => {
    const { data, error } = await sb.from("reward_bundle_categories").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

// Aggregate items count per bundle (for dashboard "most used")
export const rewardBundleItemCountsQuery = queryOptions({
  queryKey: ["reward_bundle_item_counts"],
  queryFn: async (): Promise<Array<{ bundle_id: string; total: number; guaranteed: number; random: number }>> => {
    const { data, error } = await sb.from("reward_bundle_items").select("bundle_id, guaranteed");
    if (error) throw error;
    const map = new Map<string, { total: number; guaranteed: number; random: number }>();
    for (const r of (data ?? []) as Array<{ bundle_id: string; guaranteed: boolean }>) {
      const e = map.get(r.bundle_id) ?? { total: 0, guaranteed: 0, random: 0 };
      e.total += 1;
      if (r.guaranteed) e.guaranteed += 1; else e.random += 1;
      map.set(r.bundle_id, e);
    }
    return Array.from(map.entries()).map(([bundle_id, v]) => ({ bundle_id, ...v }));
  },
  staleTime: 30_000,
});
