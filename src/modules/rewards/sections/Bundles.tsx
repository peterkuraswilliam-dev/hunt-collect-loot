import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { rewardBundlesQuery, type RewardBundle } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Bundles() {
  const qc = useQueryClient();
  const { data: bundles = [] } = useQuery(rewardBundlesQuery);
  const [editing, setEditing] = useState<Partial<RewardBundle> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<RewardBundle>) => {
      const payload = {
        slug: row.slug!,
        name: row.name!,
        description: row.description ?? null,
        rewards: row.rewards ?? [],
        status: row.status ?? "active",
      };
      if (row.id) {
        const { error } = await sb.from("reward_bundles").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("reward_bundles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reward_bundles"] }); setEditing(null); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("reward_bundles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reward_bundles"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ rewards: [], status: "active" })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Bundle
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {bundles.map((b) => (
          <div key={b.id} className="panel flex items-center justify-between px-3 py-2">
            <div>
              <div className="font-display text-sm font-bold">{b.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{b.rewards.length} reward(s) · {b.status}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(b)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => confirm(`Delete ${b.name}?`) && del.mutate(b.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {!bundles.length && <div className="panel p-6 text-center text-sm text-muted-foreground">No bundles yet.</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 sm:items-center" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-md space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Bundle" : "New Bundle"}</h3>
            <Field label="Slug"><input className={inputCls} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Rewards JSON">
              <textarea rows={6} className={`${inputCls} font-mono text-[11px]`} value={JSON.stringify(editing.rewards ?? [], null, 2)} onChange={(e) => {
                try { setEditing({ ...editing, rewards: JSON.parse(e.target.value) }); } catch { /* ignore */ }
              }} />
              <p className="mt-1 text-[10px] text-muted-foreground">Example: {`[{"kind":"credits","amount":500},{"kind":"pack","pack_slug":"bronze"}]`}</p>
            </Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={save.isPending || !editing.slug || !editing.name} onClick={() => save.mutate(editing)} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
