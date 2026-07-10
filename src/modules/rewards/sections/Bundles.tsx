import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Search, GripVertical, X } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import {
  rewardBundlesQuery,
  rewardBundleItemsQuery,
  rewardBundleCategoriesQuery,
  rewardsQuery,
  rewardTypesQuery,
  type RewardBundle,
  type RewardBundleItem,
} from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const PAGE_SIZE = 25;

type ItemDraft = Omit<RewardBundleItem, "id" | "bundle_id"> & { id?: string; _tmpId: string };

const KIND_VALUE: Record<string, number> = { credits: 1, xp: 2, energy: 5, pack: 500, asset: 50, unlock: 200 };

export function Bundles() {
  const qc = useQueryClient();
  const { data: bundles = [] } = useQuery(rewardBundlesQuery);
  const { data: categories = [] } = useQuery(rewardBundleCategoriesQuery);
  const { data: rewards = [] } = useQuery(rewardsQuery);
  const { data: types = [] } = useQuery(rewardTypesQuery);

  const rewardById = useMemo(() => new Map(rewards.map((r) => [r.id, r])), [rewards]);
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const categoryBySlug = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<"all" | "yes" | "no">("all");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<RewardBundle> | null>(null);
  const [items, setItems] = useState<ItemDraft[]>([]);

  const { data: loadedItems = [] } = useQuery(rewardBundleItemsQuery(editing?.id ?? null));

  // Load items into local draft when opening an existing bundle
  const loadedKey = editing?.id ?? "";
  const [loadedFor, setLoadedFor] = useState<string>("");
  if (loadedKey && loadedKey !== loadedFor) {
    setLoadedFor(loadedKey);
    setItems(loadedItems.map((it) => ({ ...it, _tmpId: it.id })));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bundles.filter((b) => {
      if (q && !b.name.toLowerCase().includes(q) && !(b.description ?? "").toLowerCase().includes(q)) return false;
      if (categoryFilter && b.category !== categoryFilter) return false;
      if (enabledFilter === "yes" && !b.enabled) return false;
      if (enabledFilter === "no" && b.enabled) return false;
      return true;
    });
  }, [bundles, search, categoryFilter, enabledFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const summary = useMemo(() => {
    const total = items.length;
    const guaranteed = items.filter((i) => i.guaranteed).length;
    const random = total - guaranteed;
    const value = items.reduce((sum, it) => {
      const r = rewardById.get(it.reward_id);
      if (!r) return sum;
      const t = typeById.get(r.reward_type_id);
      const qty = it.quantity_override ?? r.quantity;
      const base = t ? KIND_VALUE[t.kind] ?? 10 : 10;
      return sum + qty * base;
    }, 0);
    return { total, guaranteed, random, value };
  }, [items, rewardById, typeById]);

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const internalId = editing.internal_id ?? editing.slug ?? "";
      const payload = {
        slug: editing.slug ?? internalId,
        internal_id: internalId,
        name: editing.name!,
        description: editing.description ?? null,
        icon: editing.icon ?? null,
        category: editing.category ?? null,
        enabled: editing.enabled ?? true,
        tags: editing.tags ?? [],
        estimated_value: summary.value,
        status: editing.enabled === false ? "disabled" : "active",
      };
      let bundleId = editing.id;
      if (bundleId) {
        const { error } = await sb.from("reward_bundles").update(payload).eq("id", bundleId);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("reward_bundles").insert(payload).select("id").single();
        if (error) throw error;
        bundleId = data.id as string;
      }
      // Replace items
      const { error: delErr } = await sb.from("reward_bundle_items").delete().eq("bundle_id", bundleId);
      if (delErr) throw delErr;
      if (items.length > 0) {
        const rows = items.map((it, i) => ({
          bundle_id: bundleId,
          reward_id: it.reward_id,
          quantity_override: it.quantity_override,
          guaranteed: it.guaranteed,
          weight: it.weight,
          display_order: i,
        }));
        const { error: insErr } = await sb.from("reward_bundle_items").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reward_bundles"] });
      qc.invalidateQueries({ queryKey: ["reward_bundle_item_counts"] });
      qc.invalidateQueries({ queryKey: ["reward_bundle_items"] });
      setEditing(null);
      setItems([]);
      setLoadedFor("");
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("reward_bundles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reward_bundles"] });
      qc.invalidateQueries({ queryKey: ["reward_bundle_item_counts"] });
    },
  });

  function openNew() {
    setEditing({ enabled: true, tags: [], category: categories[0]?.slug ?? null });
    setItems([]);
    setLoadedFor("new");
  }
  function openEdit(b: RewardBundle) {
    setEditing(b);
  }
  function closeDrawer() {
    setEditing(null);
    setItems([]);
    setLoadedFor("");
  }

  function addItem(rewardId: string) {
    setItems((prev) => [
      ...prev,
      { _tmpId: crypto.randomUUID(), reward_id: rewardId, quantity_override: null, guaranteed: true, weight: 1, display_order: prev.length },
    ]);
  }
  function updateItem(tmpId: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it) => (it._tmpId === tmpId ? { ...it, ...patch } : it)));
  }
  function removeItem(tmpId: string) {
    setItems((prev) => prev.filter((it) => it._tmpId !== tmpId));
  }

  // Drag-and-drop reorder
  const [dragId, setDragId] = useState<string | null>(null);
  function onDragStart(id: string) { setDragId(id); }
  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i._tmpId === dragId);
      const to = prev.findIndex((i) => i._tmpId === overId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  function onDragEnd() { setDragId(null); }

  return (
    <div className="space-y-3">
      <div className="panel p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input className={inputCls + " pl-7"} placeholder="Search bundles…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <select className={inputCls + " w-auto"} value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <select className={inputCls + " w-auto"} value={enabledFilter} onChange={(e) => { setEnabledFilter(e.target.value as "all" | "yes" | "no"); setPage(0); }}>
            <option value="all">All</option>
            <option value="yes">Enabled</option>
            <option value="no">Disabled</option>
          </select>
          <button onClick={openNew} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> New Bundle
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-widest text-primary">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2 text-right">Est. value</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((b) => (
                <tr key={b.id} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2 font-semibold">{b.name}<div className="text-[10px] text-muted-foreground">{b.internal_id ?? b.slug}</div></td>
                  <td className="px-3 py-2">{categoryBySlug.get(b.category ?? "")?.name ?? b.category ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{b.tags.join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{b.estimated_value.toLocaleString()}</td>
                  <td className="px-3 py-2">{b.enabled ? <span className="text-primary">Active</span> : <span className="text-muted-foreground">Disabled</span>}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(b)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => confirm(`Delete ${b.name}?`) && del.mutate(b.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No bundles match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
          <span className="text-muted-foreground">{filtered.length} bundles</span>
          <div className="flex items-center gap-2">
            <button className="btn-secondary px-2 py-1 text-xs disabled:opacity-40" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {page + 1} / {pageCount}</span>
            <button className="btn-secondary px-2 py-1 text-xs disabled:opacity-40" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 sm:items-center" onClick={closeDrawer}>
          <div className="panel-gold w-full max-w-2xl max-h-[92vh] overflow-y-auto space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">{editing.id ? "Edit Bundle" : "New Bundle"}</h3>
              <button onClick={closeDrawer} className="rounded p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Bundle Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Internal ID"><input className={inputCls} value={editing.internal_id ?? ""} onChange={(e) => setEditing({ ...editing, internal_id: e.target.value, slug: editing.slug ?? e.target.value })} /></Field>
            </div>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Icon (lucide name)"><input className={inputCls} value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></Field>
              <Field label="Category">
                <select className={inputCls} value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  <option value="">—</option>
                  {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Tags (comma separated)">
              <input className={inputCls} value={(editing.tags ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </Field>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.enabled ?? true} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> Enabled
            </label>

            {/* Summary */}
            <div className="grid grid-cols-4 gap-2 rounded border border-border bg-surface-2 p-2 text-center text-xs">
              <div><div className="text-[10px] text-muted-foreground uppercase">Total</div><div className="font-bold">{summary.total}</div></div>
              <div><div className="text-[10px] text-muted-foreground uppercase">Guaranteed</div><div className="font-bold text-primary">{summary.guaranteed}</div></div>
              <div><div className="text-[10px] text-muted-foreground uppercase">Random</div><div className="font-bold">{summary.random}</div></div>
              <div><div className="text-[10px] text-muted-foreground uppercase">Est. Value</div><div className="font-bold">{summary.value.toLocaleString()}</div></div>
            </div>

            {/* Items list */}
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-primary">Rewards in bundle</div>
              {items.length === 0 && <p className="text-xs text-muted-foreground">No rewards added yet.</p>}
              {items.map((it) => {
                const r = rewardById.get(it.reward_id);
                const t = r ? typeById.get(r.reward_type_id) : undefined;
                return (
                  <div
                    key={it._tmpId}
                    draggable
                    onDragStart={() => onDragStart(it._tmpId)}
                    onDragOver={(e) => onDragOver(e, it._tmpId)}
                    onDragEnd={onDragEnd}
                    className={`flex flex-wrap items-center gap-2 rounded border border-border bg-surface-2 p-2 ${dragId === it._tmpId ? "opacity-60" : ""}`}
                  >
                    <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                    <div className="flex-1 min-w-[160px]">
                      <div className="text-xs font-semibold">{r?.name ?? "Unknown reward"}</div>
                      <div className="text-[10px] text-muted-foreground">{t?.name ?? "—"} · default qty {r?.quantity ?? "—"}</div>
                    </div>
                    <input
                      type="number"
                      placeholder="qty"
                      className={inputCls + " w-20"}
                      value={it.quantity_override ?? ""}
                      onChange={(e) => updateItem(it._tmpId, { quantity_override: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                    <select
                      className={inputCls + " w-32"}
                      value={it.guaranteed ? "guaranteed" : "random"}
                      onChange={(e) => updateItem(it._tmpId, { guaranteed: e.target.value === "guaranteed" })}
                    >
                      <option value="guaranteed">Guaranteed</option>
                      <option value="random">Random</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      className={inputCls + " w-16"}
                      value={it.weight}
                      onChange={(e) => updateItem(it._tmpId, { weight: Math.max(1, Number(e.target.value)) })}
                      title="Weight"
                    />
                    <button onClick={() => removeItem(it._tmpId)} className="rounded p-1 text-destructive hover:bg-surface"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                );
              })}
              <AddRewardPicker rewards={rewards} typeById={typeById} onPick={addItem} />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={closeDrawer} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={save.isPending || !editing.name || !editing.internal_id} onClick={() => save.mutate()} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">
                {save.isPending ? "Saving…" : "Save Bundle"}
              </button>
            </div>
            {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function AddRewardPicker({
  rewards,
  typeById,
  onPick,
}: {
  rewards: import("../queries").Reward[];
  typeById: Map<string, import("../queries").RewardType>;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rewards.slice(0, 8);
    return rewards.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 12);
  }, [rewards, query]);
  return (
    <div className="rounded border border-dashed border-border p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Add reward</div>
      <input className={inputCls} placeholder="Search library…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mt-1 flex flex-wrap gap-1">
        {filtered.map((r) => {
          const t = typeById.get(r.reward_type_id);
          return (
            <button
              key={r.id}
              onClick={() => onPick(r.id)}
              className="rounded border border-border bg-surface px-2 py-1 text-[11px] hover:border-primary"
              style={{ borderColor: t?.color ?? undefined }}
              title={t?.name ?? ""}
            >
              + {r.name}
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-xs text-muted-foreground">No matches.</p>}
      </div>
    </div>
  );
}

// Fake type binding used to satisfy compiler in AddRewardPicker signature above.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const rewardById: Map<string, import("../queries").Reward> = new Map();
