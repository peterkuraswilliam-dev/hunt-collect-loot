import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { assetsQuery, collectionsQuery } from "@/lib/queries";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import { RarityBadge } from "@/components/RarityBadge";
import type { Asset, Rarity } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/assets")({
  component: AssetsAdmin,
});

const RARITIES: Rarity[] = ["common", "rare", "epic", "legendary"];

function AssetsAdmin() {
  const qc = useQueryClient();
  const { data: assets = [] } = useQuery(assetsQuery);
  const { data: collections = [] } = useQuery(collectionsQuery);
  const [editing, setEditing] = useState<Partial<Asset> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<Asset>) => {
      const payload = {
        slug: row.slug!,
        name: row.name!,
        description: row.description ?? null,
        image_url: row.image_url ?? null,
        rarity: (row.rarity ?? "common") as Rarity,
        collection_id: row.collection_id ?? null,
        sort_order: row.sort_order ?? 0,
      };
      if (row.id) {
        const { error } = await supabase.from("assets").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      setEditing(null);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ rarity: "common", sort_order: assets.length })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Asset
        </button>
      </div>

      <AdminTable
        rows={assets}
        columns={[
          { key: "name", label: "Name", render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: "rarity", label: "Rarity", render: (r) => <RarityBadge rarity={r.rarity} /> },
          {
            key: "collection",
            label: "Collection",
            render: (r) => collections.find((c) => c.id === r.collection_id)?.name ?? "—",
          },
          { key: "sort", label: "Sort", render: (r) => r.sort_order },
          {
            key: "actions",
            label: "",
            className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => confirm(`Delete ${r.name}?`) && del.mutate(r.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 sm:items-center" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-md space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Asset" : "New Asset"}</h3>
            <Field label="Slug"><input className={inputCls} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Image URL"><input className={inputCls} value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Rarity">
                <select className={inputCls} value={editing.rarity ?? "common"} onChange={(e) => setEditing({ ...editing, rarity: e.target.value as Rarity })}>
                  {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Collection">
                <select className={inputCls} value={editing.collection_id ?? ""} onChange={(e) => setEditing({ ...editing, collection_id: e.target.value || null })}>
                  <option value="">— none —</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
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
