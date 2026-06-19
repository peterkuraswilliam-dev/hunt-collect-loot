import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Asset, Collection, GameSettings, Pack, UserStats } from "./types";

export const collectionsQuery = queryOptions({
  queryKey: ["collections"],
  queryFn: async (): Promise<Collection[]> => {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as Collection[];
  },
  staleTime: 60_000,
});

export const assetsQuery = queryOptions({
  queryKey: ["assets"],
  queryFn: async (): Promise<Asset[]> => {
    const { data, error } = await supabase
      .from("assets")
      .select("*")
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as Asset[];
  },
  staleTime: 60_000,
});

export const packsQuery = queryOptions({
  queryKey: ["packs"],
  queryFn: async (): Promise<Pack[]> => {
    const { data, error } = await supabase
      .from("packs")
      .select("*")
      .order("sort_order");
    if (error) throw error;
    return (data ?? []) as Pack[];
  },
  staleTime: 60_000,
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async (): Promise<GameSettings> => {
    const { data, error } = await supabase
      .from("game_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return data as GameSettings;
  },
  staleTime: 60_000,
});

export const meStatsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["user_stats", userId],
    queryFn: async (): Promise<UserStats> => {
      const { data, error } = await supabase
        .from("user_stats")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data as UserStats;
    },
    staleTime: 5_000,
  });

export const inventoryQuery = (userId: string) =>
  queryOptions({
    queryKey: ["inventory", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_inventory")
        .select("quantity, first_obtained_at, assets:asset_id (*)")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []) as Array<{ quantity: number; first_obtained_at: string; assets: Asset }>;
    },
    staleTime: 5_000,
  });

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });
