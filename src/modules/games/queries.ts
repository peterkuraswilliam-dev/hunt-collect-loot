import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type Game = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  status: string;
  include_tags: string[];
  exclude_tags: string[];
  enabled_modules: string[];
  sort_order: number;
};

export type MiniGame = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  game_id: string | null;
  status: string;
  config: Record<string, unknown>;
  sort_order: number;
};

export type Realm = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  game_id: string | null;
  image_url: string | null;
  status: string;
  sort_order: number;
};

export type Location = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  realm_id: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  sort_order: number;
};

function list<T>(key: string, table: string) {
  return queryOptions({
    queryKey: [key],
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await sb.from(table).select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as T[];
    },
    staleTime: 30_000,
  });
}

export const gamesQuery = list<Game>("games", "games");
export const miniGamesQuery = list<MiniGame>("mini_games", "mini_games");
export const realmsQuery = list<Realm>("realms", "realms");
export const locationsQuery = list<Location>("locations", "locations");
