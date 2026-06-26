import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type Currency = {
  id: string;
  slug: string;
  name: string;
  symbol: string | null;
  icon: string | null;
  description: string | null;
  is_system: boolean;
  enabled: boolean;
  sort_order: number;
};

export const currenciesQuery = queryOptions({
  queryKey: ["currencies"],
  queryFn: async (): Promise<Currency[]> => {
    const { data, error } = await sb.from("currencies").select("*").order("sort_order");
    if (error) throw error;
    return (data ?? []) as Currency[];
  },
  staleTime: 60_000,
});

export const userStatsTotalsQuery = queryOptions({
  queryKey: ["user_stats_totals"],
  queryFn: async () => {
    const { data, error } = await sb.from("user_stats").select("credits, xp, energy, packs_opened, spin_tokens");
    if (error) throw error;
    const rows = (data ?? []) as Array<{ credits: number; xp: number; energy: number; packs_opened: number; spin_tokens: number }>;
    const acc = { credits: 0, xp: 0, energy: 0, packs_opened: 0, spin_tokens: 0, users: 0 };
    for (const r of rows) {
      acc.credits += r.credits ?? 0;
      acc.xp += r.xp ?? 0;
      acc.energy += r.energy ?? 0;
      acc.packs_opened += r.packs_opened ?? 0;
      acc.spin_tokens += r.spin_tokens ?? 0;
      acc.users += 1;
    }
    return acc;
  },
  staleTime: 30_000,
});

export const activityRecentQuery = queryOptions({
  queryKey: ["activity_recent"],
  queryFn: async () => {
    const { data, error } = await sb
      .from("activity_log")
      .select("id, user_id, kind, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as Array<{ id: string; user_id: string; kind: string; payload: Record<string, unknown>; created_at: string }>;
  },
  staleTime: 15_000,
});
