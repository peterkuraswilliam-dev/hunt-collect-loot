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
