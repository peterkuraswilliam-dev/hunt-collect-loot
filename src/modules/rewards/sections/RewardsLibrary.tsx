import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Search, Link2, RefreshCw, Download, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { rewardsQuery, rewardTypesQuery, assetsForImportQuery, type Reward } from "../queries";
import { ImportAssetsWizard } from "../components/ImportAssetsWizard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const PAGE_SIZE = 25;

function statusPill(s: Reward["asset_sync_status"]) {
  const map: Record<string, string> = {
    linked: "bg-emerald-500/15 text-emerald-400",
    awaiting_sync: "bg-amber-500/15 text-amber-400",
    unlinked: "bg-muted/40 text-muted-foreground",
    orphaned: "bg-red-500/15 text-red-400",
  };
  return map[s] ?? map.unlinked;
}

export function RewardsLibrary() {
  const qc = useQueryClient();
  const { data: rewards = [] } = useQuery(rewardsQuery);
  const { data: types = [] } = useQuery(rewardTypesQuery);
  const { data: assets = [] } = useQuery(assetsForImportQuery);
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<"all" | "yes" | "no">("all");
  const [linkFilter, setLinkFilter] = useState<"all" | "linked" | "awaiting_sync" | "unlinked" | "orphaned">("all");
  const [sortBy, setSortBy] = useState<"created_at" | "name" | "quantity">("created_at");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<Reward> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = rewards.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q)) return false;
      if (typeFilter && r.reward_type_id !== typeFilter) return false;
      if (rarityFilter && r.rarity !== rarityFilter) return false;
      if (enabledFilter === "yes" && !r.enabled) return false;
      if (enabledFilter === "no" && r.enabled) return false;
      if (linkFilter !== "all" && r.asset_sync_status !== linkFilter) return false;
      return true;
    });
    rows = rows.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "quantity") return b.quantity - a.quantity;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return rows;
  }, [rewards, search, typeFilter, rarityFilter, enabledFilter, linkFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const save = useMutation({
    mutationFn: async (row: Partial<Reward>) => {
      const payload = {
        name: row.name!,
        reward_type_id: row.reward_type_id!,
        description: row.description ?? null,
        icon: row.icon ?? null,
        quantity: row.quantity ?? 1,
        rarity: row.rarity ?? "common",
        enabled: row.enabled ?? true,
        tags: row.tags ?? [],
      };
      if (row.id) {
        const { error } = await sb.from("rewards").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("rewards").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      setEditing(null);
    },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards"] }),
  });

  const syncOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.rpc("sync_reward_from_asset", { p_reward_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards"] }),
  });

  const resyncBulk = useMutation({
    mutationFn: async (ids: string[] | null) => {
      const { error } = await sb.rpc("resync_linked_rewards", { p_reward_ids: ids });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards"] }),
  });

  const linkedAsset = editing?.asset_id ? assetById.get(editing.asset_id) : null;
  const selectedLinkedIds = Array.from(selectedIds).filter((id) => rewards.find((r) => r.id === id)?.asset_id);

  return (
    <div className="space-y-3">
      <div className="panel p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              className={inputCls + " pl-7"}
              placeholder="Search rewards…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>
          <select className={inputCls + " w-auto"} value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}>
            <option value="">All types</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className={inputCls + " w-auto"} value={rarityFilter} onChange={(e) => { setRarityFilter(e.target.value); setPage(0); }}>
            <option value="">All rarities</option>
            {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={inputCls + " w-auto"} value={linkFilter} onChange={(e) => { setLinkFilter(e.target.value as typeof linkFilter); setPage(0); }}>
            <option value="all">All links</option>
            <option value="linked">Linked</option>
            <option value="awaiting_sync">Awaiting sync</option>
            <option value="unlinked">Unlinked</option>
            <option value="orphaned">Orphaned</option>
          </select>
          <select className={inputCls + " w-auto"} value={enabledFilter} onChange={(e) => { setEnabledFilter(e.target.value as "all" | "yes" | "no"); setPage(0); }}>
            <option value="all">All</option>
            <option value="yes">Enabled</option>
            <option value="no">Disabled</option>
          </select>
          <select className={inputCls + " w-auto"} value={sortBy} onChange={(e) => setSortBy(e.target.value as "created_at" | "name" | "quantity")}>
            <option value="created_at">Newest</option>
            <option value="name">Name</option>
            <option value="quantity">Quantity</option>
          </select>
          <button
            onClick={() => setImportOpen(true)}
            className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Download className="h-3.5 w-3.5" /> Import Assets
          </button>
          <button
            onClick={() => setEditing({ enabled: true, quantity: 1, rarity: "common", tags: [], reward_type_id: types[0]?.id })}
            className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> New Reward
          </button>
        </div>
        {(selectedIds.size > 0 || rewards.some((r) => r.asset_id)) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2 text-xs">
            <span className="text-muted-foreground">{selectedIds.size} selected</span>
            <button
              disabled={selectedLinkedIds.length === 0 || resyncBulk.isPending}
              onClick={() => resyncBulk.mutate(selectedLinkedIds)}
              className="btn-secondary inline-flex items-center gap-1 px-2 py-1 disabled:opacity-40"
            >
              <RefreshCw className="h-3 w-3" /> Re-sync selected ({selectedLinkedIds.length})
            </button>
            <button
              disabled={resyncBulk.isPending}
              onClick={() => resyncBulk.mutate(null)}
              className="btn-secondary inline-flex items-center gap-1 px-2 py-1 disabled:opacity-40"
            >
              <RefreshCw className="h-3 w-3" /> Re-sync all linked
            </button>
          </div>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-widest text-primary">
              <tr>
                <th className="px-2 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && paginated.every((r) => selectedIds.has(r.id))}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      if (e.target.checked) paginated.forEach((r) => next.add(r.id));
                      else paginated.forEach((r) => next.delete(r.id));
                      setSelectedIds(next);
                    }}
                  />
                </th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Asset link</th>
                <th className="px-3 py-2">Rarity</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((r) => {
                const t = typeById.get(r.reward_type_id);
                const a = r.asset_id ? assetById.get(r.asset_id) : null;
                return (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]" style={{ background: (t?.color ?? "#8B5CF6") + "22", color: t?.color ?? "#8B5CF6" }}>
                        {t?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.asset_id ? (
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3 w-3 text-primary" />
                          <span className="truncate max-w-[110px]">{a?.name ?? "Missing"}</span>
                          <span className={`rounded px-1 text-[9px] ${statusPill(r.asset_sync_status)}`}>{r.asset_sync_status.replace("_", " ")}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">Manual</span>
                      )}
                    </td>
                    <td className="px-3 py-2 capitalize">{r.rarity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.quantity}</td>
                    <td className="px-3 py-2">{r.enabled ? <span className="text-primary">Active</span> : <span className="text-muted-foreground">Disabled</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {r.asset_id && (
                          <button title="Sync from asset" onClick={() => syncOne.mutate(r.id)} className="rounded p-1 hover:bg-surface-2">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => confirm(`Delete ${r.name}?`) && del.mutate(r.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>No rewards match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs">
          <span className="text-muted-foreground">{filtered.length} rewards</span>
          <div className="flex items-center gap-2">
            <button className="btn-secondary px-2 py-1 text-xs disabled:opacity-40" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {page + 1} / {pageCount}</span>
            <button className="btn-secondary px-2 py-1 text-xs disabled:opacity-40" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 sm:items-center" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-md space-y-3 p-4 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Reward" : "New Reward"}</h3>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Reward Type">
                <select className={inputCls} value={editing.reward_type_id ?? ""} onChange={(e) => setEditing({ ...editing, reward_type_id: e.target.value })}>
                  <option value="">—</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Rarity">
                <select className={inputCls} value={editing.rarity ?? "common"} onChange={(e) => setEditing({ ...editing, rarity: e.target.value })}>
                  {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Icon (lucide name or URL)"><input className={inputCls} value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></Field>
              <Field label="Quantity"><input type="number" className={inputCls} value={editing.quantity ?? 1} onChange={(e) => setEditing({ ...editing, quantity: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Tags (comma separated)">
              <input
                className={inputCls}
                value={(editing.tags ?? []).join(", ")}
                onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.enabled ?? true} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> Enabled
            </label>

            {editing.id && editing.asset_id && (
              <div className="panel p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] uppercase tracking-widest text-primary">Asset Link</span>
                  <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] ${statusPill(editing.asset_sync_status as Reward["asset_sync_status"])}`}>
                    {(editing.asset_sync_status ?? "linked").replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {linkedAsset?.image_url ? (
                    <img src={linkedAsset.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-surface-2" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{linkedAsset?.name ?? "(missing asset)"}</div>
                    <div className="text-[10px] text-muted-foreground truncate">ID {editing.asset_id?.slice(0, 8)} · v{editing.asset_version}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Last synced {editing.asset_synced_at ? new Date(editing.asset_synced_at).toLocaleString() : "—"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => syncOne.mutate(editing.id!)}
                    disabled={syncOne.isPending}
                    className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-[10px]"
                  >
                    <RefreshCw className="h-3 w-3" /> Sync now
                  </button>
                  <a
                    href="/admin/modules/assets"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-[10px]"
                  >
                    <ExternalLink className="h-3 w-3" /> Open asset
                  </a>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={save.isPending || !editing.name || !editing.reward_type_id} onClick={() => save.mutate(editing)} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
            {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
          </div>
        </div>
      )}

      <ImportAssetsWizard open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
