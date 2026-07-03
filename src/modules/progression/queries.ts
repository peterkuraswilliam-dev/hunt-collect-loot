import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type ProgressionType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  category: string;
  entity_type: string;
  status: string;
  max_level: number;
  starting_level: number;
  starting_xp: number;
  allow_overflow_xp: boolean;
  default_curve_id: string | null;
  xp_display_name: string;
  visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProgressionEntityType = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  sort_order: number;
};

export type XPCurve = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  notes: string | null;
  growth_type: string;
  base_xp: number;
  starting_xp: number;
  growth_multiplier: number;
  growth_factor: number;
  max_level: number;
  decimal_precision: number;
  smoothing: boolean;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};


export type ProgressionLevel = {
  id: string;
  progression_type_id: string | null;
  level_number: number;
  xp_required: number;
  xp_from_previous: number;
  title: string | null;
  icon: string | null;
  notes: string | null;
  status: string;
};

export type XPSource = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
  base_xp: number;
  scaling_enabled: boolean;
  daily_cap: number | null;
  weekly_cap: number | null;
  cooldown_seconds: number;
  min_level: number;
  max_level: number | null;
  sort_order: number;
};

export type XPMultiplier = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  value: number;
  priority: number;
  stackable: boolean;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  sort_order: number;
};

const list = <T,>(table: string, key: string, order = "sort_order") =>
  queryOptions({
    queryKey: [key],
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await sb.from(table).select("*").order(order, { ascending: true });
      if (error) throw error;
      return (data ?? []) as T[];
    },
    staleTime: 30_000,
  });

export const progressionTypesQuery = list<ProgressionType>("progression_types", "progression_types");
export const xpCurvesQuery = list<XPCurve>("xp_curves", "xp_curves", "name");
export const progressionLevelsQuery = list<ProgressionLevel>("progression_levels", "progression_levels", "level_number");
export const xpSourcesQuery = list<XPSource>("xp_sources", "xp_sources");
export const xpMultipliersQuery = list<XPMultiplier>("xp_multipliers", "xp_multipliers");
export const progressionEntityTypesQuery = list<ProgressionEntityType>(
  "progression_entity_types",
  "progression_entity_types",
);
