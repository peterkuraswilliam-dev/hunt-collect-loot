import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { collectionsQuery, assetsQuery } from "@/lib/queries";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import type { Collection } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/collections")({
  component: CollectionsAdmin,
});

function CollectionsAdmin() {
  const qc = useQueryClient();
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: assets = [] } = useQuery(assetsQuery);
  const [editing, setEditing] = useState<(Partial<Collection> & { bonuses_json?: string }) | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<Collection> & { bonuses_json?: string; realm_slug?: string | null }) => {
      let bonuses = row.bonuses;
      if (row.bonuses_json !== undefined) {
        try { bonuses = JSON.parse(row.bonuses_json); }
        catch { throw new Error("Bonuses is not valid JSON"); }
      }
      const payload = {
        slug: row.slug!,
        name: row.name!,
        description: row.description ?? null,
        image_url: row.image_url ?? null,
        reward_credits: row.reward_credits ?? 1000,
        reward_xp: row.reward_xp ?? 500,
        sort_order: row.sort_order ?? 0,
        bonuses: bonuses ?? [],
        realm_slug: row.realm_slug ?? null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      if (row.id) {
        const { error } = await sb.from("collections").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("collections").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections"] });
      setEditing(null);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ reward_credits: 1000, reward_xp: 500, sort_order: collections.length })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Collection
        </button>
      </div>

      <AdminTable
        rows={collections}
        columns={[
          { key: "name", label: "Name", render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: "assets", label: "Assets", render: (r) => assets.filter((a) => a.collection_id === r.id).length },
          { key: "credits", label: "Reward ⛃", render: (r) => r.reward_credits },
          { key: "xp", label: "Reward XP", render: (r) => r.reward_xp },
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
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Collection" : "New Collection"}</h3>
            <Field label="Slug"><input className={inputCls} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Image URL"><input className={inputCls} value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></Field>
            <Field label="Realm Slug (unlocked at 100%)"><input className={inputCls} value={editing.realm_slug ?? ""} onChange={(e) => setEditing({ ...editing, realm_slug: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Reward Credits"><input type="number" className={inputCls} value={editing.reward_credits ?? 1000} onChange={(e) => setEditing({ ...editing, reward_credits: Number(e.target.value) })} /></Field>
              <Field label="Reward XP"><input type="number" className={inputCls} value={editing.reward_xp ?? 500} onChange={(e) => setEditing({ ...editing, reward_xp: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Sort order"><input type="number" className={inputCls} value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
            <Field label="Bonuses (JSON array)">
              <textarea
                rows={6}
                className={`${inputCls} font-mono text-[11px]`}
                value={editing.bonuses_json ?? JSON.stringify(editing.bonuses ?? [], null, 2)}
                onChange={(e) => setEditing({ ...editing, bonuses_json: e.target.value })}
              />
            </Field>
            <p className="text-[10px] text-muted-foreground">
              Each item: <code>{`{"threshold":25,"type":"energy_max","value":5,"spin_tokens":1,"label":"…"}`}</code>
            </p>
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
