import { SimpleCrud } from "@/modules/_shared/SimpleCrud";
import { useQuery } from "@tanstack/react-query";
import { progressionTypesQuery, allSubjectProgressionQuery, demoSubjectsQuery } from "../queries";

type CatchUpConfig = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  progression_type_id: string | null;
  min_level_difference: number;
  multiplier: number;
  max_bonus: number;
  reference: string;
  priority: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
};

export function CatchUpXP() {
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const { data: allProg = [] } = useQuery(allSubjectProgressionQuery);
  const { data: subjects = [] } = useQuery(demoSubjectsQuery);
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
  const typeMap = new Map(types.map((t) => [t.id, t.name]));

  // Compute per-type average level & eligible subjects (behind by >= 3 as UI hint)
  const avgByType = new Map<string, number>();
  const byType = new Map<string, { subject_id: string; current_level: number }[]>();
  for (const p of allProg) {
    const arr = byType.get(p.progression_type_id) ?? [];
    arr.push({ subject_id: p.subject_id, current_level: p.current_level });
    byType.set(p.progression_type_id, arr);
  }
  for (const [tid, arr] of byType.entries()) {
    avgByType.set(tid, arr.reduce((s, x) => s + x.current_level, 0) / arr.length);
  }

  return (
    <div className="space-y-4">
      <SimpleCrud<CatchUpConfig>
        table="catchup_xp_configs"
        queryKey="catchup_xp_configs"
        title="Catch-Up XP Configurations"
        defaults={{
          enabled: true,
          min_level_difference: 5,
          multiplier: 1.5,
          max_bonus: 3.0,
          reference: "average_level",
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
          { key: "min_level_difference", label: "Min Level Difference", type: "number" },
          { key: "multiplier", label: "Catch-Up Multiplier", type: "number" },
          { key: "max_bonus", label: "Maximum Bonus", type: "number" },
          {
            key: "reference",
            label: "Reference",
            type: "select",
            options: [
              { value: "average_level", label: "Average Level" },
              { value: "top_percentile", label: "Top Percentile" },
              { value: "manual", label: "Manual" },
            ],
          },
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
          { key: "starts_at", label: "Starts At (ISO)" },
          { key: "ends_at", label: "Ends At (ISO)" },
          { key: "notes", label: "Notes" },
        ]}
      />

      <div className="panel p-3">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Catch-Up Eligibility Preview</p>
        {allProg.length === 0 ? (
          <p className="text-xs text-muted-foreground">No progression data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">Player</th>
                  <th className="px-2 py-1">Progression</th>
                  <th className="px-2 py-1">Level</th>
                  <th className="px-2 py-1">Avg Level</th>
                  <th className="px-2 py-1">Delta</th>
                  <th className="px-2 py-1">Eligible</th>
                </tr>
              </thead>
              <tbody>
                {allProg.map((p) => {
                  const avg = avgByType.get(p.progression_type_id) ?? 0;
                  const diff = Math.floor(avg) - p.current_level;
                  const eligible = diff >= 3;
                  return (
                    <tr key={p.id} className="border-t border-border/40">
                      <td className="px-2 py-1">{subjectMap.get(p.subject_id) ?? p.subject_id.slice(0, 8)}</td>
                      <td className="px-2 py-1">{typeMap.get(p.progression_type_id) ?? "—"}</td>
                      <td className="px-2 py-1">{p.current_level}</td>
                      <td className="px-2 py-1">{avg.toFixed(1)}</td>
                      <td className={`px-2 py-1 ${diff > 0 ? "text-primary" : "text-muted-foreground"}`}>{diff > 0 ? `+${diff}` : diff}</td>
                      <td className="px-2 py-1">
                        {eligible ? (
                          <span className="rounded-md border border-primary bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">Yes</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
