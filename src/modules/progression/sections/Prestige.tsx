import { useMemo, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { SimpleCrud } from "@/modules/_shared/SimpleCrud";
import { supabase } from "@/integrations/supabase/client";
import { demoSubjectsQuery, progressionTypesQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type PrestigeConfig = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  enabled: boolean;
  progression_type_id: string | null;
  required_max_level: number;
  max_prestige_rank: number;
  prestige_name: string;
  prestige_icon: string | null;
  prestige_color: string;
  xp_retention_pct: number;
  reset_stats: string[];
  status: string;
  sort_order: number;
  notes: string | null;
};

type SubjectPrestige = {
  id: string;
  subject_id: string;
  progression_type_id: string;
  prestige_config_id: string | null;
  current_rank: number;
  total_prestiges: number;
  last_prestige_at: string | null;
};

type PrestigeHistory = {
  id: string;
  subject_id: string;
  progression_type_id: string;
  prestige_config_id: string | null;
  from_rank: number;
  to_rank: number;
  xp_before: number;
  xp_retained: number;
  created_at: string;
};

const subjectPrestigeQuery = queryOptions({
  queryKey: ["subject_prestige"],
  queryFn: async (): Promise<SubjectPrestige[]> => {
    const { data, error } = await sb.from("subject_prestige").select("*").order("current_rank", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SubjectPrestige[];
  },
  staleTime: 10_000,
});

const prestigeHistoryQuery = queryOptions({
  queryKey: ["subject_prestige_history"],
  queryFn: async (): Promise<PrestigeHistory[]> => {
    const { data, error } = await sb
      .from("subject_prestige_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as PrestigeHistory[];
  },
  staleTime: 10_000,
});

const RESET_STAT_OPTIONS = [
  "current_xp",
  "current_level",
  "lifetime_xp",
  "sources_stats",
  "streaks",
];

export function Prestige() {
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const { data: ranks = [] } = useQuery(subjectPrestigeQuery);
  const { data: history = [] } = useQuery(prestigeHistoryQuery);
  const { data: subjects = [] } = useQuery(demoSubjectsQuery);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);
  const [search, setSearch] = useState("");

  const filteredRanks = ranks.filter((r) => {
    const name = subjectMap.get(r.subject_id) ?? r.subject_id;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <SimpleCrud<PrestigeConfig>
        table="prestige_configs"
        queryKey="prestige_configs"
        title="Prestige Configurations"
        defaults={{
          enabled: true,
          required_max_level: 100,
          max_prestige_rank: 10,
          prestige_name: "Prestige",
          prestige_color: "#f5b301",
          xp_retention_pct: 0,
          reset_stats: ["current_xp", "current_level"],
          status: "active",
          sort_order: 0,
        }}
        fields={[
          { key: "name", label: "Name" },
          { key: "slug", label: "Slug" },
          { key: "description", label: "Description", type: "textarea" },
          {
            key: "progression_type_id",
            label: "Progression Type",
            type: "select",
            options: [{ value: "", label: "— None —" }, ...types.map((t) => ({ value: t.id, label: t.name }))],
          },
          { key: "required_max_level", label: "Required Max Level", type: "number" },
          { key: "max_prestige_rank", label: "Maximum Prestige Rank", type: "number" },
          { key: "prestige_name", label: "Prestige Display Name" },
          { key: "prestige_icon", label: "Prestige Icon" },
          { key: "prestige_color", label: "Prestige Colour" },
          { key: "xp_retention_pct", label: "XP Retention %", type: "number" },
          {
            key: "reset_stats",
            label: `Reset Stats (comma separated: ${RESET_STAT_OPTIONS.join(", ")})`,
            type: "textarea",
          },
          {
            key: "enabled",
            label: "Enabled",
            type: "select",
            options: [{ value: "true", label: "Enabled" }, { value: "false", label: "Disabled" }],
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
              { value: "archived", label: "Archived" },
            ],
          },
          { key: "sort_order", label: "Sort order", type: "number" },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
      />

      <div className="panel p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-widest text-primary">Player Prestige Ranks</p>
          <input
            className="rounded border border-border bg-surface-2 px-2 py-1 text-xs"
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filteredRanks.length === 0 ? (
          <p className="text-xs text-muted-foreground">No prestige progression yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-2 py-1">Player</th>
                <th className="px-2 py-1">Progression</th>
                <th className="px-2 py-1">Rank</th>
                <th className="px-2 py-1">Total Prestiges</th>
                <th className="px-2 py-1">Last</th>
              </tr>
            </thead>
            <tbody>
              {filteredRanks.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-2 py-1">{subjectMap.get(r.subject_id) ?? r.subject_id.slice(0, 8)}</td>
                  <td className="px-2 py-1">{typeMap.get(r.progression_type_id) ?? "—"}</td>
                  <td className="px-2 py-1 font-semibold text-primary">{r.current_rank}</td>
                  <td className="px-2 py-1">{r.total_prestiges}</td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {r.last_prestige_at ? new Date(r.last_prestige_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-primary">Prestige History</p>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No prestige events yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-2 py-1">When</th>
                <th className="px-2 py-1">Player</th>
                <th className="px-2 py-1">From → To</th>
                <th className="px-2 py-1">XP Before</th>
                <th className="px-2 py-1">Retained</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-border/40">
                  <td className="px-2 py-1 text-muted-foreground">{new Date(h.created_at).toLocaleString()}</td>
                  <td className="px-2 py-1">{subjectMap.get(h.subject_id) ?? h.subject_id.slice(0, 8)}</td>
                  <td className="px-2 py-1 font-semibold">{h.from_rank} → {h.to_rank}</td>
                  <td className="px-2 py-1">{h.xp_before.toLocaleString()}</td>
                  <td className="px-2 py-1 text-primary">{h.xp_retained.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
