import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable, inputCls } from "@/components/admin/AdminTable";
import { assetsQuery } from "@/lib/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Utility() {
  const qc = useQueryClient();
  const { data: assets = [] } = useQuery(assetsQuery);
  const [edits, setEdits] = useState<Record<string, { credits_per_hour?: number; energy_per_hour?: number; xp_per_hour?: number }>>({});

  useEffect(() => setEdits({}), [assets]);

  const save = useMutation({
    mutationFn: async () => {
      for (const [id, patch] of Object.entries(edits)) {
        const { error } = await sb.from("assets").update(patch).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets"] }); setEdits({}); },
  });

  function patch(id: string, key: "credits_per_hour" | "energy_per_hour" | "xp_per_hour", val: number) {
    setEdits((s) => ({ ...s, [id]: { ...s[id], [key]: val } }));
  }

  return (
    <div className="space-y-3">
      <div className="panel-gold p-3">
        <p className="text-xs">Edit per-hour production for each asset. <span className="text-muted-foreground">Multipliers are scaled globally in the Multipliers tab.</span></p>
      </div>
      <AdminTable
        rows={assets}
        columns={[
          { key: "name", label: "Asset", render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: "credits", label: "Credits/hr", render: (r) => (
            <input type="number" step="0.1" className={`${inputCls} h-8 w-20 px-2 py-1 text-xs`}
              defaultValue={r.credits_per_hour ?? 0}
              onChange={(e) => patch(r.id, "credits_per_hour", Number(e.target.value))} />
          ) },
          { key: "energy", label: "Energy/hr", render: (r) => (
            <input type="number" step="0.1" className={`${inputCls} h-8 w-20 px-2 py-1 text-xs`}
              defaultValue={r.energy_per_hour ?? 0}
              onChange={(e) => patch(r.id, "energy_per_hour", Number(e.target.value))} />
          ) },
          { key: "xp", label: "XP/hr", render: (r) => (
            <input type="number" step="0.1" className={`${inputCls} h-8 w-20 px-2 py-1 text-xs`}
              defaultValue={r.xp_per_hour ?? 0}
              onChange={(e) => patch(r.id, "xp_per_hour", Number(e.target.value))} />
          ) },
        ]}
      />
      <div className="flex justify-end">
        <button disabled={!Object.keys(edits).length || save.isPending} onClick={() => save.mutate()} className="btn-gold px-4 py-2 text-xs disabled:opacity-50">
          {save.isPending ? "Saving…" : `Save ${Object.keys(edits).length} change(s)`}
        </button>
      </div>
    </div>
  );
}
