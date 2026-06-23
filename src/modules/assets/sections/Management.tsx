import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { assetsQuery, collectionsQuery } from "@/lib/queries";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import type { Asset, Rarity } from "@/lib/types";
import { assetRaritiesQuery, assetTagsQuery, assetTypesQuery, tagsQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type AssetRow = Asset & { asset_type_id?: string | null; status?: string };

export function Management() {
  const qc = useQueryClient();
  const { data: assets = [] } = useQuery(assetsQuery);
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: types = [] } = useQuery(assetTypesQuery);
  const { data: rarities = [] } = useQuery(assetRaritiesQuery);
  const { data: tags = [] } = useQuery(tagsQuery);
  const { data: assetTags = [] } = useQuery(assetTagsQuery);

  const [editing, setEditing] = useState<Partial<AssetRow> & { tag_ids?: string[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState<{ status?: string; asset_type_id?: string; rarity?: string; add_tags?: string[] }>({});

  const tagsByAsset = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const at of assetTags) {
      const arr = m.get(at.asset_id) ?? [];
      arr.push(at.tag_id);
      m.set(at.asset_id, arr);
    }
    return m;
  }, [assetTags]);

  const save = useMutation({
    mutationFn: async (row: Partial<AssetRow> & { tag_ids?: string[] }) => {
      const payload = {
        slug: row.slug!,
        name: row.name!,
        description: row.description ?? null,
        image_url: row.image_url ?? null,
        rarity: (row.rarity ?? "common") as Rarity,
        collection_id: row.collection_id ?? null,
        asset_type_id: row.asset_type_id ?? null,
        status: row.status ?? "active",
        sort_order: row.sort_order ?? 0,
        energy_per_hour: row.energy_per_hour ?? 0,
        credits_per_hour: row.credits_per_hour ?? 0,
        xp_per_hour: row.xp_per_hour ?? 0,
      };
      let id = row.id;
      if (id) {
        const { error } = await sb.from("assets").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("assets").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      // Sync tags
      await sb.from("asset_tags").delete().eq("asset_id", id);
      const tagIds = row.tag_ids ?? [];
      if (tagIds.length) {
        await sb.from("asset_tags").insert(tagIds.map((t) => ({ asset_id: id, tag_id: t })));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["asset_tags"] });
      setEditing(null);
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });

  const bulkApply = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const patch: Record<string, unknown> = {};
      if (bulk.status) patch.status = bulk.status;
      if (bulk.asset_type_id) patch.asset_type_id = bulk.asset_type_id;
      if (bulk.rarity) patch.rarity = bulk.rarity;
      if (Object.keys(patch).length) {
        const { error } = await sb.from("assets").update(patch).in("id", ids);
        if (error) throw error;
      }
      if (bulk.add_tags?.length) {
        const rows = ids.flatMap((aid) => bulk.add_tags!.map((tid) => ({ asset_id: aid, tag_id: tid })));
        await sb.from("asset_tags").upsert(rows, { onConflict: "asset_id,tag_id" });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
      qc.invalidateQueries({ queryKey: ["asset_tags"] });
      setBulkOpen(false);
      setSelected(new Set());
      setBulk({});
    },
  });

  function toggle(id: string) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{assets.length} assets · {selected.size} selected</p>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button onClick={() => setBulkOpen(true)} className="rounded-md border border-primary px-3 py-1.5 text-xs font-semibold text-primary">
              Bulk Edit ({selected.size})
            </button>
          )}
          <button onClick={() => setEditing({ rarity: "common", status: "active", sort_order: assets.length, tag_ids: [] })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> New Asset
          </button>
        </div>
      </div>

      <AdminTable
        rows={assets as AssetRow[]}
        columns={[
          {
            key: "sel",
            label: "",
            render: (r) => <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />,
          },
          { key: "name", label: "Name", render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: "type", label: "Type", render: (r) => types.find((t) => t.id === r.asset_type_id)?.name ?? "—" },
          { key: "rarity", label: "Rarity", render: (r) => r.rarity },
          { key: "status", label: "Status", render: (r) => r.status ?? "active" },
          {
            key: "tags",
            label: "Tags",
            render: (r) => {
              const ids = tagsByAsset.get(r.id) ?? [];
              const names = ids.map((i) => tags.find((t) => t.id === i)?.name).filter(Boolean);
              return names.length ? <span className="text-[11px]">{names.join(", ")}</span> : <span className="text-muted-foreground">—</span>;
            },
          },
          {
            key: "actions", label: "", className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button onClick={() => setEditing({ ...r, tag_ids: tagsByAsset.get(r.id) ?? [] })} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => confirm(`Delete ${r.name}?`) && del.mutate(r.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
      />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 sm:items-center" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-md space-y-3 overflow-y-auto p-4 max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Asset" : "New Asset"}</h3>
            <Field label="Slug"><input className={inputCls} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Image URL"><input className={inputCls} value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <select className={inputCls} value={editing.asset_type_id ?? ""} onChange={(e) => setEditing({ ...editing, asset_type_id: e.target.value || null })}>
                  <option value="">— none —</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Rarity">
                <select className={inputCls} value={editing.rarity ?? "common"} onChange={(e) => setEditing({ ...editing, rarity: e.target.value as Rarity })}>
                  {rarities.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                </select>
              </Field>
              <Field label="Collection">
                <select className={inputCls} value={editing.collection_id ?? ""} onChange={(e) => setEditing({ ...editing, collection_id: e.target.value || null })}>
                  <option value="">— none —</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inputCls} value={editing.status ?? "active"} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
            </div>

            <Field label="Tags">
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => {
                  const on = editing.tag_ids?.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        const cur = new Set(editing.tag_ids ?? []);
                        if (on) cur.delete(t.id); else cur.add(t.id);
                        setEditing({ ...editing, tag_ids: Array.from(cur) });
                      }}
                      className={`rounded-md border px-2 py-0.5 text-[11px] ${on ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface-2 text-muted-foreground"}`}
                      style={on ? { borderColor: t.color ?? undefined } : undefined}
                    >
                      {t.name}
                    </button>
                  );
                })}
                {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags yet — create one in Tags tab.</span>}
              </div>
            </Field>

            <div className="border-t border-border pt-2">
              <p className="mb-1 text-[10px] uppercase tracking-widest text-primary">Production (per hour, per copy)</p>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Credits"><input type="number" step="0.1" className={inputCls} value={editing.credits_per_hour ?? 0} onChange={(e) => setEditing({ ...editing, credits_per_hour: Number(e.target.value) })} /></Field>
                <Field label="Energy"><input type="number" step="0.1" className={inputCls} value={editing.energy_per_hour ?? 0} onChange={(e) => setEditing({ ...editing, energy_per_hour: Number(e.target.value) })} /></Field>
                <Field label="XP"><input type="number" step="0.1" className={inputCls} value={editing.xp_per_hour ?? 0} onChange={(e) => setEditing({ ...editing, xp_per_hour: Number(e.target.value) })} /></Field>
              </div>
            </div>

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

      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={() => setBulkOpen(false)}>
          <div className="panel-gold w-full max-w-md space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">Bulk Edit ({selected.size})</h3>
            <Field label="Status">
              <select className={inputCls} value={bulk.status ?? ""} onChange={(e) => setBulk({ ...bulk, status: e.target.value || undefined })}>
                <option value="">— no change —</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Type">
              <select className={inputCls} value={bulk.asset_type_id ?? ""} onChange={(e) => setBulk({ ...bulk, asset_type_id: e.target.value || undefined })}>
                <option value="">— no change —</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Rarity">
              <select className={inputCls} value={bulk.rarity ?? ""} onChange={(e) => setBulk({ ...bulk, rarity: e.target.value || undefined })}>
                <option value="">— no change —</option>
                {rarities.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Add Tags">
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => {
                  const on = bulk.add_tags?.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => {
                      const cur = new Set(bulk.add_tags ?? []);
                      if (on) cur.delete(t.id); else cur.add(t.id);
                      setBulk({ ...bulk, add_tags: Array.from(cur) });
                    }} className={`rounded-md border px-2 py-0.5 text-[11px] ${on ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface-2"}`}>{t.name}</button>
                  );
                })}
              </div>
            </Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setBulkOpen(false)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={bulkApply.isPending} onClick={() => bulkApply.mutate()} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">
                {bulkApply.isPending ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
