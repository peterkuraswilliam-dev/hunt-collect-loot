import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Search, Link2, RefreshCw, Download, Copy, Archive,
  ArchiveRestore, CheckCircle2, CircleSlash, Filter, Save, ChevronDown,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inputCls } from "@/components/admin/AdminTable";
import {
  assetsForImportQuery, bundleItemsAllQuery, rewardTypesQuery, rewardsQuery,
  assetTypesLookupQuery, collectionsLookupQuery, type Reward,
} from "../queries";
import { ImportAssetsWizard } from "../components/ImportAssetsWizard";
import { RewardDetail } from "../components/RewardDetail";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const TIERS = ["I", "II", "III", "IV", "V"];
const PAGE_SIZE = 25;

const SAVED_KEY = "rewards.library.savedFilters";

type Filters = {
  search: string;
  typeFilter: string;
  rarityFilter: string;
  tierFilter: string;
  categoryFilter: string;
  assetTypeFilter: string;
  collectionFilter: string;
  enabledFilter: "all" | "yes" | "no";
  linkFilter: "all" | "linked" | "awaiting_sync" | "unlinked" | "orphaned";
  useFilter: "all" | "in_use" | "unused";
  archiveFilter: "active" | "archived" | "all";
};

const DEFAULT_FILTERS: Filters = {
  search: "", typeFilter: "", rarityFilter: "", tierFilter: "", categoryFilter: "",
  assetTypeFilter: "", collectionFilter: "",
  enabledFilter: "all", linkFilter: "all", useFilter: "all", archiveFilter: "active",
};

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
  const { data: assetTypes = [] } = useQuery(assetTypesLookupQuery);
  const { data: collections = [] } = useQuery(collectionsLookupQuery);
  const { data: bundleItems = [] } = useQuery(bundleItemsAllQuery);

  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const inUseSet = useMemo(() => new Set(bundleItems.map((i) => i.reward_id)), [bundleItems]);

  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedFilters, setSavedFilters] = useState<Array<{ name: string; filters: Filters }>>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSavedFilters(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);
  function persistSaved(next: Array<{ name: string; filters: Filters }>) {
    setSavedFilters(next);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  }

  const setFilter = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const [sortBy, setSortBy] = useState<"created_at" | "name" | "quantity" | "times_awarded">("created_at");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<Reward> | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkLinkOpen, setBulkLinkOpen] = useState(false);

  useEffect(() => setPage(0), [f]);

  const filtered = useMemo(() => {
    const q = f.search.trim().toLowerCase();
    let rows = rewards.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q)) return false;
      if (f.typeFilter && r.reward_type_id !== f.typeFilter) return false;
      if (f.rarityFilter && r.rarity !== f.rarityFilter) return false;
      if (f.tierFilter && r.tier !== f.tierFilter) return false;
      if (f.categoryFilter && (r.category ?? "") !== f.categoryFilter) return false;
      if (f.enabledFilter === "yes" && !r.enabled) return false;
      if (f.enabledFilter === "no" && r.enabled) return false;
      if (f.linkFilter !== "all" && r.asset_sync_status !== f.linkFilter) return false;
      if (f.useFilter === "in_use" && !inUseSet.has(r.id)) return false;
      if (f.useFilter === "unused" && inUseSet.has(r.id)) return false;
      if (f.archiveFilter === "active" && r.archived_at) return false;
      if (f.archiveFilter === "archived" && !r.archived_at) return false;
      if (f.assetTypeFilter) {
        const a = r.asset_id ? assetById.get(r.asset_id) : null;
        if (!a || a.asset_type_id !== f.assetTypeFilter) return false;
      }
      if (f.collectionFilter) {
        const a = r.asset_id ? assetById.get(r.asset_id) : null;
        if (!a || a.collection_id !== f.collectionFilter) return false;
      }
      return true;
    });
    rows = rows.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "quantity") return b.quantity - a.quantity;
      if (sortBy === "times_awarded") return (b.times_awarded ?? 0) - (a.times_awarded ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return rows;
  }, [rewards, f, sortBy, inUseSet, assetById]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    rewards.forEach((r) => { if (r.category) set.add(r.category); });
    return Array.from(set).sort();
  }, [rewards]);

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
  const cloneOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.rpc("clone_reward", { p_reward_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rewards"] }),
  });
  const bulkPatch = useMutation({
    mutationFn: async (patch: Record<string, string | boolean>) => {
      const { error } = await sb.rpc("bulk_update_rewards", {
        p_reward_ids: Array.from(selectedIds),
        p_patch: patch,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      setSelectedIds(new Set());
      setBulkEditOpen(false);
    },
  });
  const bulkLinkAsset = useMutation({
    mutationFn: async (assetId: string) => {
      const { error } = await sb.from("rewards").update({
        asset_id: assetId, asset_sync_status: "linked", source_kind: "asset", asset_synced_at: new Date().toISOString(),
      }).in("id", Array.from(selectedIds));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      setBulkLinkOpen(false);
      setSelectedIds(new Set());
    },
  });

  const selectedLinkedIds = Array.from(selectedIds).filter((id) => rewards.find((r) => r.id === id)?.asset_id);
  const anySelected = selectedIds.size > 0;

  return (
    <div className="space-y-3">
      <div className="panel p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input className={inputCls + " pl-7"} placeholder="Search rewards…" value={f.search} onChange={(e) => setFilter("search", e.target.value)} />
          </div>
          <select className={inputCls + " w-auto"} value={f.typeFilter} onChange={(e) => setFilter("typeFilter", e.target.value)}>
            <option value="">All types</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className={inputCls + " w-auto"} value={f.rarityFilter} onChange={(e) => setFilter("rarityFilter", e.target.value)}>
            <option value="">All rarities</option>
            {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={inputCls + " w-auto"} value={f.enabledFilter} onChange={(e) => setFilter("enabledFilter", e.target.value as Filters["enabledFilter"])}>
            <option value="all">All</option>
            <option value="yes">Enabled</option>
            <option value="no">Disabled</option>
          </select>
          <button onClick={() => setShowAdvanced((s) => !s)} className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs">
            <Filter className="h-3 w-3" /> Advanced <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
          <select className={inputCls + " w-auto"} value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
            <option value="created_at">Newest</option>
            <option value="name">Name</option>
            <option value="quantity">Quantity</option>
            <option value="times_awarded">Most awarded</option>
          </select>
          <button onClick={() => setImportOpen(true)} className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Import Assets
          </button>
          <button
            onClick={() => setEditing({ enabled: true, quantity: 1, rarity: "common", tags: [], reward_type_id: types[0]?.id })}
            className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> New Reward
          </button>
        </div>

        {showAdvanced && (
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4 border-t border-border pt-2">
            <select className={inputCls} value={f.tierFilter} onChange={(e) => setFilter("tierFilter", e.target.value)}>
              <option value="">All tiers</option>
              {TIERS.map((t) => <option key={t} value={t}>Tier {t}</option>)}
            </select>
            <select className={inputCls} value={f.categoryFilter} onChange={(e) => setFilter("categoryFilter", e.target.value)}>
              <option value="">All categories</option>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className={inputCls} value={f.assetTypeFilter} onChange={(e) => setFilter("assetTypeFilter", e.target.value)}>
              <option value="">All asset types</option>
              {assetTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className={inputCls} value={f.collectionFilter} onChange={(e) => setFilter("collectionFilter", e.target.value)}>
              <option value="">All collections</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={inputCls} value={f.linkFilter} onChange={(e) => setFilter("linkFilter", e.target.value as Filters["linkFilter"])}>
              <option value="all">Any link status</option>
              <option value="linked">Linked</option>
              <option value="awaiting_sync">Awaiting sync</option>
              <option value="unlinked">Unlinked</option>
              <option value="orphaned">Orphaned</option>
            </select>
            <select className={inputCls} value={f.useFilter} onChange={(e) => setFilter("useFilter", e.target.value as Filters["useFilter"])}>
              <option value="all">Any usage</option>
              <option value="in_use">In use (bundles)</option>
              <option value="unused">Unused</option>
            </select>
            <select className={inputCls} value={f.archiveFilter} onChange={(e) => setFilter("archiveFilter", e.target.value as Filters["archiveFilter"])}>
              <option value="active">Active only</option>
              <option value="archived">Archived only</option>
              <option value="all">Include archived</option>
            </select>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  const name = prompt("Save current filters as:");
                  if (name) persistSaved([...savedFilters.filter((s) => s.name !== name), { name, filters: f }]);
                }}
                className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs flex-1"
              >
                <Save className="h-3 w-3" /> Save filter
              </button>
              <button onClick={() => setF(DEFAULT_FILTERS)} className="btn-secondary px-2 py-1 text-xs">Reset</button>
            </div>
            {savedFilters.length > 0 && (
              <select
                className={inputCls + " sm:col-span-2"}
                value=""
                onChange={(e) => {
                  const saved = savedFilters.find((s) => s.name === e.target.value);
                  if (saved) setF(saved.filters);
                }}
              >
                <option value="">Load saved filter…</option>
                {savedFilters.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            )}
          </div>
        )}

        {anySelected && (
          <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2 text-xs">
            <span className="text-muted-foreground mr-1">{selectedIds.size} selected</span>
            <BulkBtn icon={CheckCircle2} onClick={() => bulkPatch.mutate({ enabled: true })}>Enable</BulkBtn>
            <BulkBtn icon={CircleSlash} onClick={() => bulkPatch.mutate({ enabled: false })}>Disable</BulkBtn>
            <BulkBtn icon={Archive} onClick={() => bulkPatch.mutate({ archived_at: "now" })}>Archive</BulkBtn>
            <BulkBtn icon={ArchiveRestore} onClick={() => bulkPatch.mutate({ archived_at: "null" })}>Restore</BulkBtn>
            <BulkBtn icon={Copy} onClick={() => selectedIds.forEach((id) => cloneOne.mutate(id))}>Clone</BulkBtn>
            <BulkBtn icon={Filter} onClick={() => setBulkEditOpen(true)}>Bulk Edit</BulkBtn>
            <BulkBtn icon={Link2} onClick={() => setBulkLinkOpen(true)}>Bulk Link Asset</BulkBtn>
            <BulkBtn icon={RefreshCw} disabled={selectedLinkedIds.length === 0} onClick={() => resyncBulk.mutate(selectedLinkedIds)}>
              Re-sync ({selectedLinkedIds.length})
            </BulkBtn>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}
        {!anySelected && rewards.some((r) => r.asset_id) && (
          <div className="flex items-center gap-2 border-t border-border pt-2 text-xs">
            <button onClick={() => resyncBulk.mutate(null)} className="btn-secondary inline-flex items-center gap-1 px-2 py-1">
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
                <th className="px-3 py-2 text-right">Awarded</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((r) => {
                const t = typeById.get(r.reward_type_id);
                const a = r.asset_id ? assetById.get(r.asset_id) : null;
                return (
                  <tr key={r.id} className={`border-b border-border/40 last:border-0 ${r.archived_at ? "opacity-50" : ""}`}>
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
                    <td className="px-3 py-2">
                      <button onClick={() => setEditing(r)} className="font-semibold hover:text-primary text-left">{r.name}</button>
                      {r.category && <div className="text-[10px] text-muted-foreground">{r.category}{r.tier ? ` · Tier ${r.tier}` : ""}</div>}
                    </td>
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
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{(r.times_awarded ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {r.archived_at ? <span className="text-red-400">Archived</span> :
                        r.enabled ? <span className="text-primary">Active</span> : <span className="text-muted-foreground">Disabled</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {r.asset_id && (
                          <button title="Sync" onClick={() => syncOne.mutate(r.id)} className="rounded p-1 hover:bg-surface-2">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button title="Clone" onClick={() => cloneOne.mutate(r.id)} className="rounded p-1 hover:bg-surface-2"><Copy className="h-3.5 w-3.5" /></button>
                        <button title="Delete" onClick={() => confirm(`Delete ${r.name}?`) && del.mutate(r.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={9}>No rewards match.</td></tr>
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

      {editing && <RewardDetail reward={editing} onClose={() => setEditing(null)} />}

      {bulkEditOpen && <BulkEditModal onClose={() => setBulkEditOpen(false)} onApply={(patch) => bulkPatch.mutate(patch)} pending={bulkPatch.isPending} types={types} categories={categoryOptions} />}

      {bulkLinkOpen && (
        <BulkLinkAssetModal
          assets={assets}
          onClose={() => setBulkLinkOpen(false)}
          onApply={(id) => bulkLinkAsset.mutate(id)}
          pending={bulkLinkAsset.isPending}
        />
      )}

      <ImportAssetsWizard open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function BulkBtn({ icon: Icon, onClick, children, disabled }: { icon: typeof Copy; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-[11px] disabled:opacity-40">
      <Icon className="h-3 w-3" /> {children}
    </button>
  );
}

function BulkEditModal({
  onClose, onApply, pending, types, categories,
}: {
  onClose: () => void;
  onApply: (patch: Record<string, string | boolean>) => void;
  pending: boolean;
  types: Array<{ id: string; name: string }>;
  categories: string[];
}) {
  const [patch, setPatch] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setPatch((p) => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={onClose}>
      <div className="panel-gold w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-base font-bold">Bulk Edit</h3>
        <p className="text-[11px] text-muted-foreground">Only filled fields will be applied to selected rewards.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs space-y-1"><span className="text-[10px] uppercase text-muted-foreground">Reward Type</span>
            <select className={inputCls} value={patch.reward_type_id ?? ""} onChange={(e) => set("reward_type_id", e.target.value)}>
              <option value="">— unchanged —</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="text-xs space-y-1"><span className="text-[10px] uppercase text-muted-foreground">Category</span>
            <input className={inputCls} list="cat-list" value={patch.category ?? ""} onChange={(e) => set("category", e.target.value)} placeholder="— unchanged —" />
            <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="text-xs space-y-1"><span className="text-[10px] uppercase text-muted-foreground">Tier</span>
            <select className={inputCls} value={patch.tier ?? ""} onChange={(e) => set("tier", e.target.value)}>
              <option value="">— unchanged —</option>
              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-xs space-y-1"><span className="text-[10px] uppercase text-muted-foreground">Rarity</span>
            <select className={inputCls} value={patch.rarity ?? ""} onChange={(e) => set("rarity", e.target.value)}>
              <option value="">— unchanged —</option>
              {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
          <button disabled={pending || Object.values(patch).every((v) => !v)} onClick={() => onApply(patch)} className="btn-gold flex-1 py-2 text-xs disabled:opacity-40">
            {pending ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkLinkAssetModal({
  assets, onClose, onApply, pending,
}: {
  assets: Array<{ id: string; name: string; image_url: string | null; rarity: string }>;
  onClose: () => void;
  onApply: (assetId: string) => void;
  pending: boolean;
}) {
  const [q, setQ] = useState("");
  const filtered = q ? assets.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40) : assets.slice(0, 40);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={onClose}>
      <div className="panel-gold w-full max-w-md p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-base font-bold">Link all selected to asset</h3>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input className={inputCls + " pl-7"} placeholder="Search assets…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="max-h-72 overflow-auto divide-y divide-border/40">
          {filtered.map((a) => (
            <button
              key={a.id}
              disabled={pending}
              onClick={() => onApply(a.id)}
              className="w-full flex items-center gap-2 py-1.5 px-1 text-left text-xs hover:bg-surface-2 disabled:opacity-40"
            >
              {a.image_url ? <img src={a.image_url} alt="" className="h-6 w-6 rounded object-cover" /> : <div className="h-6 w-6 rounded bg-surface-2" />}
              <span className="flex-1 font-semibold truncate">{a.name}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{a.rarity}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
      </div>
    </div>
  );
}
