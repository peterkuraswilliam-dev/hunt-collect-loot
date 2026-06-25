import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { packsAdminQuery, type PackRow } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const STATUSES = ["active", "draft", "archived"];

export function Packs() {
  const qc = useQueryClient();
  const { data: packs = [] } = useQuery(packsAdminQuery);
  const [editing, setEditing] = useState<Partial<PackRow> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<PackRow>) => {
      const payload = {
        slug: row.slug!,
        name: row.name!,
        description: row.description ?? null,
        image_url: row.image_url ?? null,
        tier: row.tier ?? "bronze",
        price_credits: row.price_credits ?? 0,
        assets_per_pack: row.assets_per_pack ?? 1,
        status: row.status ?? "active",
        sort_order: row.sort_order ?? 0,
      };
      if (row.id) {
        const { error } = await sb.from("packs").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("packs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packs_admin"] });
      qc.invalidateQueries({ queryKey: ["packs"] });
      setEditing(null);
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("packs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packs_admin"] });
      qc.invalidateQueries({ queryKey: ["packs"] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ tier: "bronze", status: "active", price_credits: 100, assets_per_pack: 3, sort_order: packs.length })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Pack
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {packs.map((p) => (
          <div key={p.id} className="panel flex items-center justify-between px-3 py-2">
            <div>
              <div className="font-display text-sm font-bold">{p.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.tier} · {p.price_credits}⛃ · {p.assets_per_pack} cards · {p.status}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(p)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => confirm(`Delete ${p.name}?`) && del.mutate(p.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        {!packs.length && <div className="panel p-6 text-center text-sm text-muted-foreground">No packs yet.</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 sm:items-center" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-md space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Pack" : "New Pack"}</h3>
            <Field label="Slug"><input className={inputCls} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Image URL"><input className={inputCls} value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Tier"><input className={inputCls} value={editing.tier ?? "bronze"} onChange={(e) => setEditing({ ...editing, tier: e.target.value })} /></Field>
              <Field label="Price"><input type="number" className={inputCls} value={editing.price_credits ?? 0} onChange={(e) => setEditing({ ...editing, price_credits: Number(e.target.value) })} /></Field>
              <Field label="Per Pack"><input type="number" className={inputCls} value={editing.assets_per_pack ?? 1} onChange={(e) => setEditing({ ...editing, assets_per_pack: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Status">
              <select className={inputCls} value={editing.status ?? "active"} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <p className="text-[10px] text-muted-foreground">Asset pool is configured in the Pack Pools tab using tags.</p>
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
