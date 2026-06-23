import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type AssetType = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_system: boolean;
};

export type AssetRarity = {
  slug: string;
  name: string;
  color: string;
  weight: number;
  sort_order: number;
  is_system: boolean;
};

export type Tag = {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  icon: string | null;
  description: string | null;
  parent_id: string | null;
};

export type AssetTag = { asset_id: string; tag_id: string };

export type AutomationRule = {
  id: string;
  module: string;
  name: string;
  enabled: boolean;
  trigger: { event?: string; match_tags?: string[]; match_mode?: "all" | "any" };
  action: { type?: string; collection_id?: string };
};

export type ModuleSettings = { module: string; settings: Record<string, unknown> };

export type ModulePermission = {
  id: string;
  module: string;
  role: "admin" | "user" | "business_owner";
  capability: "view" | "manage" | "configure";
};

export const assetTypesQuery = queryOptions({
  queryKey: ["asset_types"],
  queryFn: async (): Promise<AssetType[]> => {
    const { data, error } = await sb.from("asset_types").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

export const assetRaritiesQuery = queryOptions({
  queryKey: ["asset_rarities"],
  queryFn: async (): Promise<AssetRarity[]> => {
    const { data, error } = await sb.from("asset_rarities").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

export const tagsQuery = queryOptions({
  queryKey: ["tags"],
  queryFn: async (): Promise<Tag[]> => {
    const { data, error } = await sb.from("tags").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

export const assetTagsQuery = queryOptions({
  queryKey: ["asset_tags"],
  queryFn: async (): Promise<AssetTag[]> => {
    const { data, error } = await sb.from("asset_tags").select("asset_id, tag_id");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 30_000,
});

export const automationRulesQuery = queryOptions({
  queryKey: ["automation_rules", "assets"],
  queryFn: async (): Promise<AutomationRule[]> => {
    const { data, error } = await sb
      .from("automation_rules")
      .select("*")
      .eq("module", "assets")
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 30_000,
});

export const moduleSettingsQuery = (module: string) =>
  queryOptions({
    queryKey: ["module_settings", module],
    queryFn: async (): Promise<ModuleSettings> => {
      const { data, error } = await sb
        .from("module_settings")
        .select("*")
        .eq("module", module)
        .maybeSingle();
      if (error) throw error;
      return data ?? { module, settings: {} };
    },
    staleTime: 30_000,
  });

export const modulePermissionsQuery = (module: string) =>
  queryOptions({
    queryKey: ["module_permissions", module],
    queryFn: async (): Promise<ModulePermission[]> => {
      const { data, error } = await sb
        .from("module_permissions")
        .select("*")
        .eq("module", module);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

export const ownershipStatsQuery = queryOptions({
  queryKey: ["asset_ownership_stats"],
  queryFn: async (): Promise<Array<{ asset_id: string; total: number }>> => {
    const { data, error } = await sb.from("user_inventory").select("asset_id, quantity");
    if (error) throw error;
    const map = new Map<string, number>();
    for (const r of (data ?? []) as Array<{ asset_id: string; quantity: number }>) {
      map.set(r.asset_id, (map.get(r.asset_id) ?? 0) + r.quantity);
    }
    return Array.from(map.entries()).map(([asset_id, total]) => ({ asset_id, total }));
  },
  staleTime: 30_000,
});
