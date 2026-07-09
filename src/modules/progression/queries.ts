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
  description: string | null;
  icon: string | null;
  color: string;
  notes: string | null;
  status: string;
  display_order: number;
  visible: boolean;
  hidden: boolean;
  is_demo: boolean;
  updated_at: string;
  created_at: string;
};


export type XPSource = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  progression_type_id: string | null;
  enabled: boolean;
  status: string;
  base_xp: number;
  scaling_enabled: boolean;
  daily_cap: number | null;
  weekly_cap: number | null;
  cooldown_seconds: number;
  min_level: number;
  max_level: number | null;
  max_xp_per_action: number | null;
  icon: string | null;
  color: string;
  visible: boolean;
  hidden: boolean;
  notes: string | null;
  display_order: number;
  sort_order: number;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

export type XPSourceCategory = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  color: string;
  icon: string | null;
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
export const xpSourceCategoriesQuery = list<XPSourceCategory>(
  "xp_source_categories",
  "xp_source_categories",
);

export type DemoSubject = {
  id: string;
  name: string;
  kind: string;
  avatar: string | null;
  notes: string | null;
  created_at: string;
};

export type SubjectProgression = {
  id: string;
  subject_id: string;
  progression_type_id: string;
  current_xp: number;
  current_level: number;
  lifetime_xp: number;
  last_awarded_amount: number | null;
  last_awarded_at: string | null;
  last_level_up_at: string | null;
  updated_at: string;
  created_at: string;
};

export type XPAwardLogEntry = {
  id: string;
  subject_id: string;
  progression_type_id: string;
  xp_source_id: string | null;
  amount: number;
  xp_before: number;
  xp_after: number;
  level_before: number;
  level_after: number;
  leveled_up: boolean;
  note: string | null;
  created_at: string;
};

export const demoSubjectsQuery = queryOptions({
  queryKey: ["progression_demo_subjects"],
  queryFn: async (): Promise<DemoSubject[]> => {
    const { data, error } = await sb.from("progression_demo_subjects").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as DemoSubject[];
  },
  staleTime: 30_000,
});

export const subjectProgressionQuery = (subjectId: string | null) =>
  queryOptions({
    queryKey: ["subject_progression", subjectId],
    queryFn: async (): Promise<SubjectProgression[]> => {
      if (!subjectId) return [];
      const { data, error } = await sb
        .from("subject_progression")
        .select("*")
        .eq("subject_id", subjectId);
      if (error) throw error;
      return (data ?? []) as SubjectProgression[];
    },
    enabled: !!subjectId,
    staleTime: 5_000,
  });

export const xpAwardLogQuery = (subjectId: string | null, typeId: string | null) =>
  queryOptions({
    queryKey: ["xp_award_log", subjectId, typeId],
    queryFn: async (): Promise<XPAwardLogEntry[]> => {
      if (!subjectId || !typeId) return [];
      const { data, error } = await sb
        .from("xp_award_log")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("progression_type_id", typeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as XPAwardLogEntry[];
    },
    enabled: !!subjectId && !!typeId,
    staleTime: 2_000,
  });


export const allSubjectProgressionQuery = queryOptions({
  queryKey: ["subject_progression", "all"],
  queryFn: async (): Promise<SubjectProgression[]> => {
    const { data, error } = await sb
      .from("subject_progression")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SubjectProgression[];
  },
  staleTime: 5_000,
});

export const recentLevelUpsQuery = queryOptions({
  queryKey: ["xp_award_log", "level_ups"],
  queryFn: async (): Promise<XPAwardLogEntry[]> => {
    const { data, error } = await sb
      .from("xp_award_log")
      .select("*")
      .eq("leveled_up", true)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return (data ?? []) as XPAwardLogEntry[];
  },
  staleTime: 5_000,
});


export async function awardXp(params: {
  subjectId: string;
  progressionTypeId: string;
  xpSourceId: string | null;
  amount: number;
  note?: string;
}) {
  const { data, error } = await sb.rpc("award_xp", {
    p_subject: params.subjectId,
    p_type_id: params.progressionTypeId,
    p_source_id: params.xpSourceId,
    p_amount: params.amount,
    p_note: params.note ?? null,
  });
  if (error) throw error;
  return data as {
    subject_id: string;
    progression_type_id: string;
    xp_before: number;
    xp_after: number;
    level_before: number;
    level_after: number;
    leveled_up: boolean;
    levels_gained: number;
    next_level_xp: number | null;
  };
}

export type XPEventType = "xp_awarded" | "xp_removed" | "level_up" | "multi_level_up";
export type XPEventStatus = "processed" | "failed" | "replayed";

export type XPEvent = {
  id: string;
  subject_id: string;
  progression_type_id: string;
  xp_source_id: string | null;
  event_type: XPEventType;
  amount: number;
  xp_before: number;
  xp_after: number;
  level_before: number;
  level_after: number;
  levels_gained: number;
  status: XPEventStatus;
  error_message: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  replay_of: string | null;
  created_at: string;
};

export const xpEventsQuery = queryOptions({
  queryKey: ["xp_events"],
  queryFn: async (): Promise<XPEvent[]> => {
    const { data, error } = await sb
      .from("xp_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as XPEvent[];
  },
  staleTime: 5_000,
});

export const playerXpEventsQuery = (subjectId: string | null) =>
  queryOptions({
    queryKey: ["xp_events", "subject", subjectId],
    queryFn: async (): Promise<XPEvent[]> => {
      if (!subjectId) return [];
      const { data, error } = await sb
        .from("xp_events")
        .select("*")
        .eq("subject_id", subjectId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as XPEvent[];
    },
    enabled: !!subjectId,
    staleTime: 5_000,
  });

export async function submitXpEvent(params: {
  subjectId: string;
  progressionTypeId: string;
  xpSourceId: string | null;
  amount: number;
  note?: string;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await sb.rpc("submit_xp_event", {
    p_subject: params.subjectId,
    p_type_id: params.progressionTypeId,
    p_source_id: params.xpSourceId,
    p_amount: params.amount,
    p_note: params.note ?? null,
    p_metadata: params.metadata ?? {},
  });
  if (error) throw error;
  return data as { ok: boolean; event_id: string; event_type?: XPEventType; error?: string };
}

export async function replayXpEvent(eventId: string) {
  const { data, error } = await sb.rpc("replay_xp_event", { p_event_id: eventId });
  if (error) throw error;
  return data as { ok: boolean; event_id: string };
}


