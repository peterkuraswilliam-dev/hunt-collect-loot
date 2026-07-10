import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { progressionTypesQuery, type ProgressionType } from "@/modules/progression/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type PlayerProgression = {
  type: ProgressionType | null;
  level: number;
  currentXp: number;
  nextXp: number | null;
  lifetimeXp: number;
  pct: number;
  typeName: string;
};

export function usePlayerProgression(userId: string): PlayerProgression {
  const qc = useQueryClient();
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const playerType =
    types.find((t) => t.category === "player" || t.slug === "player") ?? types[0] ?? null;
  const typeId = playerType?.id ?? null;

  const { data: prog } = useQuery({
    queryKey: ["subject_progression", userId, typeId],
    enabled: !!userId && !!typeId,
    staleTime: 5_000,
    queryFn: async () => {
      const { data } = await sb
        .from("subject_progression")
        .select("current_xp,current_level,lifetime_xp")
        .eq("subject_id", userId)
        .eq("progression_type_id", typeId)
        .maybeSingle();
      return (data ?? null) as {
        current_xp: number;
        current_level: number;
        lifetime_xp: number;
      } | null;
    },
  });

  const currentLevel = prog?.current_level ?? playerType?.starting_level ?? 1;

  const { data: nextXp = null } = useQuery({
    queryKey: ["prog_next_xp", typeId, currentLevel],
    enabled: !!typeId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await sb.rpc("progression_next_level_xp", {
        p_type_id: typeId,
        p_current_level: currentLevel,
      });
      return (data as number | null) ?? null;
    },
  });

  // Realtime: refresh when this player's progression row changes
  const channelIdRef = useRef<string>(Math.random().toString(36).slice(2));
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`player-prog-${userId}-${channelIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subject_progression",
          filter: `subject_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["subject_progression", userId] });
          qc.invalidateQueries({ queryKey: ["prog_next_xp"] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "xp_award_log",
          filter: `subject_id=eq.${userId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["subject_progression", userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const currentXp = prog?.current_xp ?? playerType?.starting_xp ?? 0;
  const lifetimeXp = prog?.lifetime_xp ?? 0;
  const pct =
    nextXp && nextXp > 0 ? Math.min(100, Math.round((currentXp / nextXp) * 100)) : 0;

  return {
    type: playerType,
    level: currentLevel,
    currentXp,
    nextXp,
    lifetimeXp,
    pct,
    typeName: playerType?.xp_display_name || playerType?.name || "XP",
  };
}
