import { SimpleCrud } from "@/modules/_shared/SimpleCrud";
import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { demoSubjectsQuery, progressionTypesQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type RestedConfig = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  progression_type_id: string | null;
  regen_rate_per_hour: number;
  max_storage: number;
  bonus_multiplier: number;
  offline_accumulation: boolean;
  expires_after_hours: number | null;
  priority: number;
  status: string;
  notes: string | null;
};

type SubjectRested = {
  id: string;
  subject_id: string;
  progression_type_id: string;
  stored_xp: number;
  last_accrued_at: string;
  last_used_at: string | null;
};

const subjectRestedQuery = queryOptions({
  queryKey: ["subject_rested_xp"],
  queryFn: async (): Promise<SubjectRested[]> => {
    const { data, error } = await sb.from("subject_rested_xp").select("*").order("stored_xp", { ascending: false });
    if (error) throw error;
    return (data ?? []) as SubjectRested[];
  },
  staleTime: 10_000,
});

export function RestedXP() {
  const { data: pools = [] } = useQuery(subjectRestedQuery);
  const { data: subjects = [] } = useQuery(demoSubjectsQuery);
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
  const typeMap = new Map(types.map((t) => [t.id, t.name]));

  return (
    <div className="space-y-4">
      <SimpleCrud<RestedConfig>
        table="rested_xp_configs"
        queryKey="rested_xp_configs"
        title="Rested XP Configurations"
        defaults={{
          enabled: true,
          regen_rate_per_hour: 100,
          max_storage: 10000,
          bonus_multiplier: 2.0,
          offline_accumulation: true,
          expires_after_hours: 168,
          priority: 100,
          status: "active",
        }}
        fields={[
          { key: "name", label: "Name" },
          { key: "description", label: "Description" },
          {
            key: "progression_type_id",
            label: "Progression Type",
            type: "select",
            options: [{ value: "", label: "All Types" }, ...types.map((t) => ({ value: t.id, label: t.name }))],
          },
          { key: "regen_rate_per_hour", label: "Regen Rate / Hour", type: "number" },
          { key: "max_storage", label: "Maximum Storage", type: "number" },
          { key: "bonus_multiplier", label: "Bonus Multiplier", type: "number" },
          {
            key: "offline_accumulation",
            label: "Offline Accumulation",
            type: "select",
            options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }],
          },
          { key: "expires_after_hours", label: "Expires After (hours)", type: "number" },
          { key: "priority", label: "Priority", type: "number" },
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
          { key: "notes", label: "Notes" },
        ]}
      />

      <div className="panel p-3">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Player Rested Pools</p>
        {pools.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rested XP stored yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">Player</th>
                  <th className="px-2 py-1">Progression</th>
                  <th className="px-2 py-1">Stored XP</th>
                  <th className="px-2 py-1">Last Accrued</th>
                  <th className="px-2 py-1">Last Used</th>
                </tr>
              </thead>
              <tbody>
                {pools.map((p) => (
                  <tr key={p.id} className="border-t border-border/40">
                    <td className="px-2 py-1">{subjectMap.get(p.subject_id) ?? p.subject_id.slice(0, 8)}</td>
                    <td className="px-2 py-1">{typeMap.get(p.progression_type_id) ?? "—"}</td>
                    <td className="px-2 py-1 font-semibold text-primary">{p.stored_xp.toLocaleString()}</td>
                    <td className="px-2 py-1 text-muted-foreground">{new Date(p.last_accrued_at).toLocaleString()}</td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {p.last_used_at ? new Date(p.last_used_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
