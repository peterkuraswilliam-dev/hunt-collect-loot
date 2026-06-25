import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { rewardTypesQuery, type RewardType } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const KINDS = ["asset", "credits", "energy", "xp", "ic", "pack", "spin", "unlock", "bundle"];

export function RewardTypes() {
  const qc = useQueryClient();
  const { data: types = [] } = useQuery(rewardTypesQuery);
  const [editing, setEditing] = useState<Partial<RewardType> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<RewardType>) => {
      const payload = {
        slug: row.slug!,
        name: row.name!,
        kind: row.kind ?? "credits",
        icon: row.icon ?? null,
        description: row.description ?? null,
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
        <button onClick={() => setEditing({ kind: "credits", sort_order: types.length })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Type
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {types.map((t) => (
          <div key={t.id} className="panel flex items-center justify-between px-3 py-2">
            <div>
              <div className="font-display text-sm font-bold">{t.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.kind} · {t.slug}{t.is_system ? " · system" : ""}</div>
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
            <Field label="Slug"><input className={inputCls} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Kind">
              <select className={inputCls} value={editing.kind ?? "credits"} onChange={(e) => setEditing({ ...editing, kind: e.target.value })}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
            <Field label="Icon (lucide name)"><input className={inputCls} value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></Field>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Sort order"><input type="number" className={inputCls} value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
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
