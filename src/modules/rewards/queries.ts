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
  asset_id: string | null;
  asset_version: number;
  asset_synced_at: string | null;
  asset_sync_status: "linked" | "awaiting_sync" | "unlinked" | "orphaned";
  imported_at: string | null;
  source_kind: "manual" | "asset" | "collection" | "item_set" | "template";
  archived_at: string | null;
  tier: string | null;
  category: string | null;
  times_awarded: number;
  times_claimed: number;
  last_awarded_at: string | null;
};

export type RewardActivityRow = {
  id: string;
  reward_id: string;
  action: string;
  actor_id: string | null;
  actor_label: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

export const rewardActivityQuery = (rewardId: string | null) =>
  queryOptions({
    queryKey: ["reward_activity", rewardId],
    enabled: !!rewardId,
    queryFn: async (): Promise<RewardActivityRow[]> => {
      if (!rewardId) return [];
      const { data, error } = await sb
        .from("reward_activity_log")
        .select("*")
        .eq("reward_id", rewardId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });

export const rewardReferencesQuery = (rewardId: string | null) =>
  queryOptions({
    queryKey: ["reward_references", rewardId],
    enabled: !!rewardId,
    queryFn: async () => {
      if (!rewardId) return { bundles: [] as Array<{ id: string; name: string; enabled: boolean; updated_at: string; quantity_override: number | null; guaranteed: boolean }> };
      const { data, error } = await sb
        .from("reward_bundle_items")
        .select("quantity_override,guaranteed,bundle:bundle_id(id,name,enabled,updated_at)")
        .eq("reward_id", rewardId);
      if (error) throw error;
      const bundles = ((data ?? []) as Array<{ bundle: { id: string; name: string; enabled: boolean; updated_at: string } | null; quantity_override: number | null; guaranteed: boolean }>)
        .map((r) =>
          r.bundle
            ? { id: r.bundle.id, name: r.bundle.name, enabled: r.bundle.enabled, updated_at: r.bundle.updated_at, quantity_override: r.quantity_override, guaranteed: r.guaranteed }
            : null,
        )
        .filter(Boolean) as Array<{ id: string; name: string; enabled: boolean; updated_at: string; quantity_override: number | null; guaranteed: boolean }>;
      return { bundles };
    },
    staleTime: 15_000,
  });

export const bundleItemsAllQuery = queryOptions({
  queryKey: ["reward_bundle_items_all"],
  queryFn: async (): Promise<Array<{ reward_id: string; bundle_id: string }>> => {
    const { data, error } = await sb.from("reward_bundle_items").select("reward_id,bundle_id");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 30_000,
});

export type AssetForImport = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  rarity: string;
  status: string;
  collection_id: string | null;
  asset_type_id: string | null;
  credits_per_hour: number;
  energy_per_hour: number;
  xp_per_hour: number;
};

export const assetsForImportQuery = queryOptions({
  queryKey: ["rewards_assets_for_import"],
  queryFn: async (): Promise<AssetForImport[]> => {
    const { data, error } = await sb
      .from("assets")
      .select("id,slug,name,description,image_url,rarity,status,collection_id,asset_type_id,credits_per_hour,energy_per_hour,xp_per_hour")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 30_000,
});

export const assetTypesLookupQuery = queryOptions({
  queryKey: ["rewards_asset_types_lookup"],
  queryFn: async (): Promise<Array<{ id: string; name: string; slug: string }>> => {
    const { data, error } = await sb.from("asset_types").select("id,name,slug").order("name");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

export const collectionsLookupQuery = queryOptions({
  queryKey: ["rewards_collections_lookup"],
  queryFn: async (): Promise<Array<{ id: string; name: string; slug: string }>> => {
    const { data, error } = await sb.from("collections").select("id,name,slug").order("name");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

export const collectionSetsLookupQuery = queryOptions({
  queryKey: ["rewards_collection_sets_lookup"],
  queryFn: async (): Promise<Array<{ id: string; name: string; slug: string }>> => {
    const { data, error } = await sb.from("collection_sets").select("id,name,slug").order("name");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});


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
