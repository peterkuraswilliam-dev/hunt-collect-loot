import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { packsQuery } from "@/lib/queries";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import type { Pack, Rarity } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/packs")({
  component: PacksAdmin,
});

const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

function PacksAdmin() {
  const qc = useQueryClient();
  const { data: packs = [] } = useQuery(packsQuery);
  const [editing, setEditing] = useState<Partial<Pack> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<Pack>) => {
      const payload = {
        slug: row.slug!,
        name: row.name!,
        description: row.description ?? null,
        image_url: row.image_url ?? null,
        tier: row.tier ?? "bronze",
        price_credits: row.price_credits ?? 100,
        assets_per_pack: row.assets_per_pack ?? 3,
        sort_order: row.sort_order ?? 0,
      };
      if (row.id) {
        const { error } = await supabase.from("packs").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("packs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packs"] });
      setEditing(null);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("packs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packs"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ tier: "bronze", price_credits: 100, assets_per_pack: 3, sort_order: packs.length })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Pack
        </button>
      </div>

      <div className="space-y-2">
        {packs.map((p) => (
          <div key={p.id} className="panel overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="text-muted-foreground">
                {expanded === p.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <div className="flex-1">
                <div className="font-display text-sm font-bold">{p.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{p.tier} · {p.price_credits}⛃ · {p.assets_per_pack} cards</div>
              </div>
              <button onClick={() => setEditing(p)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => confirm(`Delete ${p.name}?`) && del.mutate(p.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            {expanded === p.id && <DropRatesEditor packId={p.id} />}
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
              <Field label="Price"><input type="number" className={inputCls} value={editing.price_credits ?? 100} onChange={(e) => setEditing({ ...editing, price_credits: Number(e.target.value) })} /></Field>
              <Field label="Per Pack"><input type="number" className={inputCls} value={editing.assets_per_pack ?? 3} onChange={(e) => setEditing({ ...editing, assets_per_pack: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Sort order"><input type="number" className={inputCls} value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={save.isPending || !editing.slug || !editing.name} onClick={() => save.mutate(editing)} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">
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

function DropRatesEditor({ packId }: { packId: string }) {
  const qc = useQueryClient();
  const { data: rates = [] } = useQuery({
    queryKey: ["pack_drop_rates", packId],
    queryFn: async () => {
      const { data, error } = await supabase.from("pack_drop_rates").select("*").eq("pack_id", packId);
      if (error) throw error;
      return data;
    },
  });
  const [local, setLocal] = useState<Record<string, number> | null>(null);
  const weights: Record<string, number> = local ?? Object.fromEntries(
    RARITIES.map((r) => [r, rates.find((x) => x.rarity === r)?.weight ?? 0])
  );
  const total = Object.values(weights).reduce((s, v) => s + v, 0);

  const saveRates = useMutation({
    mutationFn: async () => {
      const rows = RARITIES.map((r) => ({ pack_id: packId, rarity: r, weight: weights[r] ?? 0 }));
      const { error } = await supabase.from("pack_drop_rates").upsert(rows, { onConflict: "pack_id,rarity" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pack_drop_rates", packId] });
      setLocal(null);
    },
  });

  return (
    <div className="border-t border-border bg-surface-2/50 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Drop Rates (weights)</div>
      <div className="grid grid-cols-4 gap-2">
        {RARITIES.map((r) => (
          <Field key={r} label={r}>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={weights[r] ?? 0}
              onChange={(e) => setLocal({ ...weights, [r]: Number(e.target.value) })}
            />
            <div className="mt-1 text-center text-[10px] text-muted-foreground">
              {total > 0 ? `${Math.round(((weights[r] ?? 0) / total) * 100)}%` : "0%"}
            </div>
          </Field>
        ))}
      </div>
      <div className="mt-2 flex justify-end">
        <button disabled={saveRates.isPending} onClick={() => saveRates.mutate()} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Save className="h-3.5 w-3.5" /> {saveRates.isPending ? "Saving…" : "Save Rates"}
        </button>
      </div>
    </div>
  );
}
