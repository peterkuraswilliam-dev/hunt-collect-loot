import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type CollectionSet = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
};

export type CollectionRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
  type: string | null;
  status: string;
  set_id: string | null;
  include_tags: string[];
  exclude_tags: string[];
  match_mode: "all" | "any";
  rewards: Array<{ threshold: number; type: string; value?: number; pack_slug?: string; asset_rarity?: string }>;
  bonuses: Array<{ threshold: number; type: string; value?: number; spin_tokens?: number }>;
  reward_credits: number;
  reward_xp: number;
  sort_order: number;
  realm_slug: string | null;
  created_at: string;
};

export const collectionsAllQuery = queryOptions({
  queryKey: ["collections_all"],
  queryFn: async (): Promise<CollectionRow[]> => {
    const { data, error } = await sb.from("collections").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 30_000,
});

export const collectionSetsQuery = queryOptions({
  queryKey: ["collection_sets"],
  queryFn: async (): Promise<CollectionSet[]> => {
    const { data, error } = await sb.from("collection_sets").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

export const collectionAssetsQuery = queryOptions({
  queryKey: ["collection_assets_join"],
  queryFn: async (): Promise<Array<{ collection_id: string; asset_id: string }>> => {
    const { data, error } = await sb.from("collection_assets").select("collection_id, asset_id");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 30_000,
});
