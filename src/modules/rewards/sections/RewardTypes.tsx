import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { rewardTypesQuery, type RewardType } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function RewardTypes() {
  const qc = useQueryClient();
  const { data: types = [] } = useQuery(rewardTypesQuery);
  const [editing, setEditing] = useState<Partial<RewardType> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<RewardType>) => {
      const internalId = row.internal_id ?? row.slug ?? "";
      const payload = {
        slug: row.slug ?? internalId,
        internal_id: internalId,
        name: row.name!,
        kind: row.kind ?? "asset",
        icon: row.icon ?? null,
        description: row.description ?? null,
        color: row.color ?? "#8B5CF6",
        stackable: row.stackable ?? true,
        tradable: row.tradable ?? false,
        enabled: row.enabled ?? true,
        sort_order: row.sort_order ?? 0,
      };
      if (row.id) {
        const { error } = await sb.from("reward_types").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("reward_types").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reward_types"] });
      setEditing(null);
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("reward_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reward_types"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing({ sort_order: types.length, stackable: true, tradable: false, enabled: true, color: "#8B5CF6" })}
          className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> New Type
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {types.map((t) => (
          <div key={t.id} className="panel flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: t.color ?? "#8B5CF6" }} />
              <div>
                <div className="font-display text-sm font-bold">{t.name} {!t.enabled && <span className="ml-1 text-[10px] text-muted-foreground">(disabled)</span>}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t.internal_id ?? t.slug} · {t.stackable ? "stack" : "no-stack"} · {t.tradable ? "tradable" : "bound"}{t.is_system ? " · system" : ""}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(t)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
              {!t.is_system && (
                <button onClick={() => confirm(`Delete ${t.name}?`) && del.mutate(t.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 sm:items-center" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-md space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Reward Type" : "New Reward Type"}</h3>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Internal ID"><input className={inputCls} value={editing.internal_id ?? ""} onChange={(e) => setEditing({ ...editing, internal_id: e.target.value, slug: editing.slug ?? e.target.value })} /></Field>
            </div>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Icon (lucide name)"><input className={inputCls} value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></Field>
              <Field label="Colour"><input type="color" className={inputCls + " h-10 p-1"} value={editing.color ?? "#8B5CF6"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.stackable ?? true} onChange={(e) => setEditing({ ...editing, stackable: e.target.checked })} /> Stackable</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.tradable ?? false} onChange={(e) => setEditing({ ...editing, tradable: e.target.checked })} /> Tradable</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={editing.enabled ?? true} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> Enabled</label>
            </div>
            <Field label="Sort order"><input type="number" className={inputCls} value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={save.isPending || !editing.name || !editing.internal_id} onClick={() => save.mutate(editing)} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
            {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
