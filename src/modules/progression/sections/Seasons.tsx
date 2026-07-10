import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { SimpleCrud } from "@/modules/_shared/SimpleCrud";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { demoSubjectsQuery, progressionTypesQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Season = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: "upcoming" | "active" | "ended" | "archived";
  xp_modifier: number;
  visible: boolean;
  progression_type_ids: string[];
  color: string;
  icon: string | null;
  sort_order: number;
  notes: string | null;
};

type SeasonProgress = {
  id: string;
  subject_id: string;
  season_id: string;
  progression_type_id: string;
  season_xp: number;
  events_count: number;
  last_awarded_at: string | null;
};

type SeasonHistory = {
  id: string;
  subject_id: string;
  season_id: string;
  progression_type_id: string;
  final_xp: number;
  events_count: number;
  archived_at: string;
};

const seasonsQuery = queryOptions({
  queryKey: ["seasons"],
  queryFn: async (): Promise<Season[]> => {
    const { data, error } = await sb.from("seasons").select("*").order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Season[];
  },
  staleTime: 10_000,
});

const seasonProgressQuery = queryOptions({
  queryKey: ["subject_season_progress"],
  queryFn: async (): Promise<SeasonProgress[]> => {
    const { data, error } = await sb
      .from("subject_season_progress")
      .select("*")
      .order("season_xp", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as SeasonProgress[];
  },
  staleTime: 10_000,
});

const seasonHistoryQuery = queryOptions({
  queryKey: ["subject_season_history"],
  queryFn: async (): Promise<SeasonHistory[]> => {
    const { data, error } = await sb
      .from("subject_season_history")
      .select("*")
      .order("archived_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as SeasonHistory[];
  },
  staleTime: 10_000,
});

export function Seasons() {
  const qc = useQueryClient();
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const { data: seasons = [] } = useQuery(seasonsQuery);
  const { data: progress = [] } = useQuery(seasonProgressQuery);
  const { data: history = [] } = useQuery(seasonHistoryQuery);
  const { data: subjects = [] } = useQuery(demoSubjectsQuery);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);
  const seasonMap = useMemo(() => new Map(seasons.map((s) => [s.id, s])), [seasons]);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const activeSeason = seasons.find((s) => s.status === "active");
  const filteredProgress = progress.filter((p) => {
    if (statusFilter !== "all") {
      const s = seasonMap.get(p.season_id);
      if (!s || s.status !== statusFilter) return false;
    }
    const n = subjectMap.get(p.subject_id) ?? p.subject_id;
    return n.toLowerCase().includes(search.toLowerCase());
  });

  const bulkArchive = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("seasons").update({ status: "archived" }).eq("status", "ended");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seasons"] });
      toast.success("Ended seasons archived");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {activeSeason && (
        <div className="panel-gold p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Active Season</p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <div>
              <p className="font-display text-base font-bold" style={{ color: activeSeason.color }}>{activeSeason.name}</p>
              <p className="text-xs text-muted-foreground">{activeSeason.description}</p>
            </div>
            <p className="font-display text-lg font-bold text-primary">×{activeSeason.xp_modifier}</p>
          </div>
        </div>
      )}

      <SimpleCrud<Season>
        table="seasons"
        queryKey="seasons"
        title="Seasons"
        defaults={{
          status: "upcoming",
          xp_modifier: 1.0,
          visible: true,
          color: "#3fb950",
          sort_order: 0,
          progression_type_ids: [],
        }}
        fields={[
          { key: "name", label: "Name" },
          { key: "slug", label: "Slug" },
          { key: "description", label: "Description", type: "textarea" },
          { key: "starts_at", label: "Start Date (ISO)" },
          { key: "ends_at", label: "End Date (ISO)" },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "upcoming", label: "Upcoming" },
              { value: "active", label: "Active" },
              { value: "ended", label: "Ended" },
              { value: "archived", label: "Archived" },
            ],
          },
          { key: "xp_modifier", label: "XP Modifier (e.g. 1.5)", type: "number" },
          {
            key: "visible",
            label: "Visible",
            type: "select",
            options: [{ value: "true", label: "Visible" }, { value: "false", label: "Hidden" }],
          },
          {
            key: "progression_type_ids",
            label: `Progression Type IDs (comma separated — leave empty for all). Options: ${types.map((t) => `${t.name}=${t.id}`).join(" | ")}`,
            type: "textarea",
          },
          { key: "color", label: "Colour" },
          { key: "icon", label: "Icon" },
          { key: "sort_order", label: "Sort order", type: "number" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-border bg-surface-2 px-2 py-1 text-xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="ended">Ended</option>
            <option value="archived">Archived</option>
          </select>
          <input
            className="rounded border border-border bg-surface-2 px-2 py-1 text-xs"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className="btn-gold px-3 py-1 text-xs disabled:opacity-50"
          onClick={() => bulkArchive.mutate()}
          disabled={bulkArchive.isPending}
        >
          Archive ended seasons
        </button>
      </div>

      <div className="panel p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-primary">Season Progress</p>
        {filteredProgress.length === 0 ? (
          <p className="text-xs text-muted-foreground">No season XP yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-2 py-1">Season</th>
                <th className="px-2 py-1">Player</th>
                <th className="px-2 py-1">Progression</th>
                <th className="px-2 py-1">Season XP</th>
                <th className="px-2 py-1">Events</th>
                <th className="px-2 py-1">Last Awarded</th>
              </tr>
            </thead>
            <tbody>
              {filteredProgress.map((p) => (
                <tr key={p.id} className="border-t border-border/40">
                  <td className="px-2 py-1">{seasonMap.get(p.season_id)?.name ?? "—"}</td>
                  <td className="px-2 py-1">{subjectMap.get(p.subject_id) ?? p.subject_id.slice(0, 8)}</td>
                  <td className="px-2 py-1">{typeMap.get(p.progression_type_id) ?? "—"}</td>
                  <td className="px-2 py-1 font-semibold text-primary">{p.season_xp.toLocaleString()}</td>
                  <td className="px-2 py-1">{p.events_count}</td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {p.last_awarded_at ? new Date(p.last_awarded_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-primary">Season History</p>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No archived seasons yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-2 py-1">Season</th>
                <th className="px-2 py-1">Player</th>
                <th className="px-2 py-1">Final XP</th>
                <th className="px-2 py-1">Events</th>
                <th className="px-2 py-1">Archived</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-border/40">
                  <td className="px-2 py-1">{seasonMap.get(h.season_id)?.name ?? "—"}</td>
                  <td className="px-2 py-1">{subjectMap.get(h.subject_id) ?? h.subject_id.slice(0, 8)}</td>
                  <td className="px-2 py-1 font-semibold text-primary">{h.final_xp.toLocaleString()}</td>
                  <td className="px-2 py-1">{h.events_count}</td>
                  <td className="px-2 py-1 text-muted-foreground">{new Date(h.archived_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
