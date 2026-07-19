import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2, Copy, GripVertical, Search, AlertTriangle, CheckCircle2, Package, Link2, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import {
  lootTableEntriesQuery,
  rewardsQuery,
  rewardTypesQuery,
  assetsForImportQuery,
  collectionsLookupQuery,
  assetTypesLookupQuery,
  type LootTableEntry,
  type Reward,
} from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type LootTable = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  source_type_id: string | null;
  enabled: boolean;
  allow_duplicates: boolean;
  tags: string[];
  min_rewards?: number;
  max_rewards?: number;
  fixed_roll_count?: number | null;
  selection_method?: "weighted_random" | "independent" | "guaranteed_only" | "all";
  guaranteed_first?: boolean;
  quantity_multiplier?: number;
  min_total_quantity?: number | null;
  max_total_quantity?: number | null;
};

const SELECTION_LABELS: Record<string, string> = {
  weighted_random: "Weighted Random",
  independent: "Independent Drop Chance",
  guaranteed_only: "Guaranteed Only",
  all: "Roll All Entries",
};


export function LootTableDetail({ table, onClose }: { table: LootTable; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "entries" | "rules">("entries");
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<LootTableEntry | null>(null);

  const { data: entries = [] } = useQuery(lootTableEntriesQuery(table.id));
  const { data: rewards = [] } = useQuery(rewardsQuery);
  const { data: types = [] } = useQuery(rewardTypesQuery);
  const { data: assets = [] } = useQuery(assetsForImportQuery);
  const { data: collections = [] } = useQuery(collectionsLookupQuery);
  const { data: assetTypes = [] } = useQuery(assetTypesLookupQuery);

  const rewardById = useMemo(() => new Map(rewards.map((r) => [r.id, r])), [rewards]);
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const collectionById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);
  const assetTypeById = useMemo(() => new Map(assetTypes.map((t) => [t.id, t])), [assetTypes]);

  const takenRewardIds = useMemo(() => new Set(entries.map((e) => e.reward_id)), [entries]);

  const summary = useMemo(() => {
    let assetRewards = 0;
    let native = 0;
    let broken = 0;
    for (const e of entries) {
      const r = rewardById.get(e.reward_id);
      if (!r) { broken++; continue; }
      if (r.asset_id) assetRewards++; else native++;
      if (r.archived_at) broken++;
    }
    return {
      total: entries.length,
      enabled: entries.filter((e) => e.enabled).length,
      guaranteed: entries.filter((e) => e.guaranteed).length,
      random: entries.filter((e) => !e.guaranteed).length,
      assetRewards,
      native,
      broken,
    };
  }, [entries, rewardById]);

  const addEntries = useMutation({
    mutationFn: async (rewardIds: string[]) => {
      const rows = rewardIds.map((rid, idx) => ({
        loot_table_id: table.id,
        reward_id: rid,
        weight: 1,
        drop_chance: 0,
        min_quantity: 1,
        max_quantity: 1,
        guaranteed: false,
        enabled: true,
        display_order: entries.length + idx,
      }));
      const { error } = await sb.from("loot_table_entries").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loot_table_entries", table.id] });
      qc.invalidateQueries({ queryKey: ["loot_table_entries_all"] });
      setPicking(false);
      setSelected(new Set());
      toast.success("Entries added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEntry = useMutation({
    mutationFn: async (row: Partial<LootTableEntry> & { id: string }) => {
      const { id, ...rest } = row;
      const { error } = await sb.from("loot_table_entries").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loot_table_entries", table.id] });
      qc.invalidateQueries({ queryKey: ["loot_table_entries_all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEntries = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await sb.from("loot_table_entries").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loot_table_entries", table.id] });
      qc.invalidateQueries({ queryKey: ["loot_table_entries_all"] });
      setSelected(new Set());
    },
  });

  const duplicateEntry = useMutation({
    mutationFn: async (e: LootTableEntry) => {
      if (!table.allow_duplicates) {
        toast.error("Duplicates not allowed on this table");
        return;
      }
      const { id: _id, created_at: _c, updated_at: _u, times_awarded: _t, ...rest } = e;
      const { error } = await sb.from("loot_table_entries").insert({ ...rest, display_order: entries.length });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loot_table_entries", table.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkSetEnabled = (enabled: boolean) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    Promise.all(ids.map((id) => sb.from("loot_table_entries").update({ enabled }).eq("id", id)))
      .then(() => {
        qc.invalidateQueries({ queryKey: ["loot_table_entries", table.id] });
        toast.success(`${ids.length} entr${ids.length === 1 ? "y" : "ies"} ${enabled ? "enabled" : "disabled"}`);
      });
  };

  const [dragId, setDragId] = useState<string | null>(null);
  const onDragStart = (id: string) => setDragId(id);
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ordered = [...entries];
    const from = ordered.findIndex((e) => e.id === dragId);
    const to = ordered.findIndex((e) => e.id === targetId);
    if (from < 0 || to < 0) return;
    const [m] = ordered.splice(from, 1);
    ordered.splice(to, 0, m);
    setDragId(null);
    Promise.all(ordered.map((e, idx) => sb.from("loot_table_entries").update({ display_order: idx }).eq("id", e.id)))
      .then(() => qc.invalidateQueries({ queryKey: ["loot_table_entries", table.id] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={onClose}>
      <div className="panel-gold w-full max-w-5xl flex flex-col max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-3">
          <div>
            <h3 className="font-display text-base font-bold">{table.name}</h3>
            <p className="text-[10px] text-muted-foreground">{table.description ?? "Loot table detail"}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-1 border-b border-border px-3">
          {(["entries", "rules", "overview"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-widest ${tab === k ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              {k === "entries" ? `Loot Entries (${entries.length})` : k === "rules" ? "Rules" : "Overview"}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-3 flex-1">
          {tab === "rules" && <RulesTab table={table} onSaved={() => qc.invalidateQueries({ queryKey: ["loot_tables"] })} />}
          {tab === "overview" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-6">

                <SummaryCard label="Total" value={summary.total} />
                <SummaryCard label="Enabled" value={summary.enabled} />
                <SummaryCard label="Guaranteed" value={summary.guaranteed} />
                <SummaryCard label="Random" value={summary.random} />
                <SummaryCard label="Asset Rewards" value={summary.assetRewards} />
                <SummaryCard label="Native" value={summary.native} />
              </div>
              {summary.broken > 0 && (
                <div className="panel border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {summary.broken} broken reward reference{summary.broken === 1 ? "" : "s"} — review entries.
                </div>
              )}
              <div className="panel p-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">Category:</span> {table.category ?? "—"}</div>
                <div><span className="text-muted-foreground">Allow duplicates:</span> {table.allow_duplicates ? "Yes" : "No"}</div>
                <div className="text-muted-foreground text-[11px] italic">Weighted roll execution is not implemented in this phase.</div>
              </div>
            </div>
          )}

          {tab === "entries" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
                <SummaryCard label="Total" value={summary.total} />
                <SummaryCard label="Enabled" value={summary.enabled} />
                <SummaryCard label="Guaranteed" value={summary.guaranteed} />
                <SummaryCard label="Random" value={summary.random} />
                <SummaryCard label="Asset" value={summary.assetRewards} />
                <SummaryCard label="Native" value={summary.native} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setPicking(true)} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add Entry
                </button>
                <div className="ml-auto flex items-center gap-1 text-[11px]">
                  <span className="text-muted-foreground">{selected.size} selected</span>
                  <button disabled={!selected.size} onClick={() => bulkSetEnabled(true)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Enable</button>
                  <button disabled={!selected.size} onClick={() => bulkSetEnabled(false)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Disable</button>
                  <button
                    disabled={!selected.size}
                    onClick={() => confirm(`Remove ${selected.size} entr${selected.size === 1 ? "y" : "ies"}?`) && deleteEntries.mutate(Array.from(selected))}
                    className="rounded border border-destructive/40 text-destructive px-2 py-1 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {entries.length === 0 ? (
                <div className="panel p-6 text-center text-xs text-muted-foreground">
                  No entries yet. Click <strong>Add Entry</strong> to pick rewards from the library.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {entries.map((e) => {
                    const r = rewardById.get(e.reward_id);
                    const a = r?.asset_id ? assetById.get(r.asset_id) : null;
                    const t = r ? typeById.get(r.reward_type_id) : null;
                    const broken = !r;
                    const archived = r?.archived_at != null;
                    const disabled = r && !r.enabled;
                    const assetOrphan = r?.source_kind === "asset" && !r.asset_id;
                    return (
                      <div
                        key={e.id}
                        draggable
                        onDragStart={() => onDragStart(e.id)}
                        onDragOver={(ev) => ev.preventDefault()}
                        onDrop={() => onDrop(e.id)}
                        className={`panel flex items-center gap-2 p-2 ${!e.enabled ? "opacity-60" : ""} ${broken || archived ? "border-destructive/50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(e.id)}
                          onChange={(ev) => {
                            const s = new Set(selected);
                            if (ev.target.checked) s.add(e.id); else s.delete(e.id);
                            setSelected(s);
                          }}
                        />
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        {a?.image_url ? (
                          <img src={a.image_url} alt="" className="h-10 w-10 rounded object-cover border border-border" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-surface-2 border border-border flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">{r?.name ?? "(missing reward)"}</span>
                            {t && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px]" style={{ color: t.color ?? undefined }}>{t.name}</span>}
                            {r?.rarity && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">{r.rarity}</span>}
                            {r?.tier && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">T{r.tier}</span>}
                            {a && <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px]"><Link2 className="h-2.5 w-2.5" />Asset</span>}
                            {e.guaranteed && <span className="rounded bg-emerald-500/15 text-emerald-500 px-1.5 py-0.5 text-[10px]">Guaranteed</span>}
                            {broken && <span className="rounded bg-destructive/15 text-destructive px-1.5 py-0.5 text-[10px]">Broken ref</span>}
                            {archived && <span className="rounded bg-destructive/15 text-destructive px-1.5 py-0.5 text-[10px]">Archived</span>}
                            {disabled && <span className="rounded bg-amber-500/15 text-amber-500 px-1.5 py-0.5 text-[10px]">Reward disabled</span>}
                            {assetOrphan && <span className="rounded bg-amber-500/15 text-amber-500 px-1.5 py-0.5 text-[10px]">Missing asset link</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {a ? <>Asset: {a.name} · {assetTypeById.get(a.asset_type_id ?? "")?.name ?? "—"} · {collectionById.get(a.collection_id ?? "")?.name ?? "—"}</> : (r?.category ?? r?.description ?? "Native reward")}
                          </div>
                        </div>
                        <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>Qty {e.min_quantity}-{e.max_quantity}</span>
                          <span>·</span>
                          <span>W {e.weight}</span>
                          <span>·</span>
                          <span>{Number(e.drop_chance)}%</span>
                        </div>
                        <label className="flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            checked={e.enabled}
                            onChange={(ev) => updateEntry.mutate({ id: e.id, enabled: ev.target.checked })}
                          />
                          On
                        </label>
                        <button onClick={() => setEditing(e)} className="rounded p-1 hover:bg-surface-2" title="Edit"><Info className="h-3.5 w-3.5" /></button>
                        <button onClick={() => duplicateEntry.mutate(e)} className="rounded p-1 hover:bg-surface-2" title="Duplicate"><Copy className="h-3.5 w-3.5" /></button>
                        <button
                          onClick={() => confirm("Remove entry?") && deleteEntries.mutate([e.id])}
                          className="rounded p-1 text-destructive hover:bg-surface-2"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {picking && (
        <RewardPicker
          rewards={rewards}
          types={types}
          assetById={assetById}
          takenIds={takenRewardIds}
          allowDuplicates={table.allow_duplicates}
          onClose={() => setPicking(false)}
          onConfirm={(ids) => addEntries.mutate(ids)}
        />
      )}

      {editing && (
        <EntryEditor
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateEntry.mutate({ id: editing.id, ...patch });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-extrabold">{value}</div>
    </div>
  );
}

function RewardPicker({
  rewards,
  types,
  assetById,
  takenIds,
  allowDuplicates,
  onClose,
  onConfirm,
}: {
  rewards: Reward[];
  types: Array<{ id: string; name: string; color: string | null }>;
  assetById: Map<string, { id: string; name: string; image_url: string | null }>;
  takenIds: Set<string>;
  allowDuplicates: boolean;
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rewards.filter((r) => {
      if (r.archived_at) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (typeFilter && r.reward_type_id !== typeFilter) return false;
      if (rarityFilter && r.rarity !== rarityFilter) return false;
      if (statusFilter === "enabled" && !r.enabled) return false;
      if (statusFilter === "disabled" && r.enabled) return false;
      return true;
    });
  }, [rewards, search, typeFilter, rarityFilter, statusFilter]);

  const rarities = useMemo(() => Array.from(new Set(rewards.map((r) => r.rarity))).sort(), [rewards]);

  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const confirm = () => {
    const ids = Array.from(selected);
    const disabledPicks = ids.filter((id) => {
      const r = rewards.find((x) => x.id === id);
      return r && !r.enabled;
    });
    if (disabledPicks.length > 0) {
      if (!window.confirm(`${disabledPicks.length} disabled reward(s) selected. Add anyway?`)) return;
    }
    onConfirm(ids);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 p-2" onClick={onClose}>
      <div className="panel-gold w-full max-w-3xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="font-display text-base font-bold">Pick Rewards</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-3 border-b border-border flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input className={`${inputCls} pl-7`} placeholder="Search rewards…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={inputCls + " w-auto"} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className={inputCls + " w-auto"} value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)}>
            <option value="">All rarity</option>
            {rarities.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={inputCls + " w-auto"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Any status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="overflow-y-auto p-2 flex-1 space-y-1">
          {filtered.map((r) => {
            const taken = takenIds.has(r.id) && !allowDuplicates;
            const a = r.asset_id ? assetById.get(r.asset_id) : null;
            const t = typeById.get(r.reward_type_id);
            return (
              <label
                key={r.id}
                className={`panel flex items-center gap-2 p-2 cursor-pointer ${taken ? "opacity-40 cursor-not-allowed" : ""} ${selected.has(r.id) ? "border-primary" : ""}`}
              >
                <input
                  type="checkbox"
                  disabled={taken}
                  checked={selected.has(r.id)}
                  onChange={() => !taken && toggle(r.id)}
                />
                {a?.image_url ? (
                  <img src={a.image_url} alt="" className="h-9 w-9 rounded object-cover border border-border" />
                ) : (
                  <div className="h-9 w-9 rounded bg-surface-2 border border-border flex items-center justify-center">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{r.name}</span>
                    {t && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px]" style={{ color: t.color ?? undefined }}>{t.name}</span>}
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">{r.rarity}</span>
                    {r.tier && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">T{r.tier}</span>}
                    {a && <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px]">Asset</span>}
                    {!r.enabled && <span className="rounded bg-amber-500/15 text-amber-500 px-1.5 py-0.5 text-[10px]">Disabled</span>}
                    {taken && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Already added</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{r.category ?? r.description ?? "—"}</div>
                </div>
              </label>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center p-4">No rewards match filters.</p>}
        </div>
        <div className="border-t border-border p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs">Cancel</button>
            <button disabled={selected.size === 0} onClick={confirm} className="btn-gold px-3 py-1.5 text-xs disabled:opacity-50">
              Add {selected.size} to table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryEditor({ entry, onClose, onSave }: { entry: LootTableEntry; onClose: () => void; onSave: (patch: Partial<LootTableEntry>) => void }) {
  const [draft, setDraft] = useState<LootTableEntry>(entry);
  const errors: string[] = [];
  if (draft.min_quantity > draft.max_quantity) errors.push("Min quantity cannot exceed max quantity");
  if (draft.weight < 0) errors.push("Weight cannot be negative");
  if (Number(draft.drop_chance) < 0 || Number(draft.drop_chance) > 100) errors.push("Drop chance must be 0–100");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/90 p-2" onClick={onClose}>
      <div className="panel-gold w-full max-w-md space-y-3 p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold">Edit Loot Entry</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Min Quantity">
            <input type="number" min={0} className={inputCls} value={draft.min_quantity} onChange={(e) => setDraft({ ...draft, min_quantity: Number(e.target.value) })} />
          </Field>
          <Field label="Max Quantity">
            <input type="number" min={0} className={inputCls} value={draft.max_quantity} onChange={(e) => setDraft({ ...draft, max_quantity: Number(e.target.value) })} />
          </Field>
          <Field label="Weight">
            <input type="number" min={0} className={inputCls} value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })} />
          </Field>
          <Field label="Drop Chance (%)">
            <input type="number" min={0} max={100} step="0.01" className={inputCls} value={Number(draft.drop_chance)} onChange={(e) => setDraft({ ...draft, drop_chance: Number(e.target.value) })} />
          </Field>
          <Field label="Display Order">
            <input type="number" className={inputCls} value={draft.display_order} onChange={(e) => setDraft({ ...draft, display_order: Number(e.target.value) })} />
          </Field>
          <div className="flex flex-col gap-2 pt-4">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={draft.guaranteed} onChange={(e) => setDraft({ ...draft, guaranteed: e.target.checked })} />
              Guaranteed
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
              Enabled
            </label>
          </div>
        </div>
        <Field label="Admin Notes">
          <textarea className={inputCls} rows={3} value={draft.admin_notes ?? ""} onChange={(e) => setDraft({ ...draft, admin_notes: e.target.value })} />
        </Field>
        {errors.length > 0 && (
          <div className="rounded bg-destructive/10 text-destructive text-xs p-2 space-y-0.5">
            {errors.map((err) => <div key={err} className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />{err}</div>)}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded border border-border py-2 text-xs">Cancel</button>
          <button
            disabled={errors.length > 0}
            onClick={() => onSave({
              min_quantity: draft.min_quantity,
              max_quantity: draft.max_quantity,
              weight: draft.weight,
              drop_chance: draft.drop_chance,
              guaranteed: draft.guaranteed,
              enabled: draft.enabled,
              display_order: draft.display_order,
              admin_notes: draft.admin_notes,
            })}
            className="btn-gold flex-1 py-2 text-xs disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            <Save className="h-3.5 w-3.5" /> Save
          </button>
        </div>
      </div>
    </div>
  );
}

function RulesTab({ table, onSaved }: { table: LootTable; onSaved: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState({
    selection_method: table.selection_method ?? "weighted_random",
    min_rewards: table.min_rewards ?? 1,
    max_rewards: table.max_rewards ?? 1,
    fixed_roll_count: table.fixed_roll_count ?? null,
    allow_duplicates: table.allow_duplicates ?? false,
    guaranteed_first: table.guaranteed_first ?? true,
    enabled: table.enabled ?? true,
    quantity_multiplier: table.quantity_multiplier ?? 1,
    min_total_quantity: table.min_total_quantity ?? null,
    max_total_quantity: table.max_total_quantity ?? null,
  });

  const errors: string[] = [];
  const warnings: string[] = [];
  if (d.min_rewards > d.max_rewards) errors.push("Min Rolls must be ≤ Max Rolls");
  if (d.min_rewards < 0) errors.push("Min Rolls cannot be negative");
  if (d.fixed_roll_count != null && d.fixed_roll_count < 0) errors.push("Fixed Roll Count cannot be negative");
  if (d.min_total_quantity != null && d.max_total_quantity != null && d.min_total_quantity > d.max_total_quantity) {
    errors.push("Min Total Quantity must be ≤ Max Total Quantity");
  }
  if (d.quantity_multiplier < 0) errors.push("Quantity Multiplier cannot be negative");
  if (d.selection_method === "all" && d.fixed_roll_count != null) warnings.push("Fixed Roll Count is ignored when Selection Method is 'Roll All Entries'.");
  if (d.selection_method === "guaranteed_only") warnings.push("Only entries marked Guaranteed will be granted.");
  if (d.fixed_roll_count != null && (d.fixed_roll_count < d.min_rewards || d.fixed_roll_count > d.max_rewards)) {
    warnings.push("Fixed Roll Count falls outside the Min/Max range and will override it.");
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("loot_tables").update(d).eq("id", table.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rules saved"); qc.invalidateQueries({ queryKey: ["loot_tables"] }); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rollDesc = d.fixed_roll_count != null
    ? `Rolls exactly ${d.fixed_roll_count} reward${d.fixed_roll_count === 1 ? "" : "s"}`
    : d.min_rewards === d.max_rewards
      ? `Rolls ${d.min_rewards} reward${d.min_rewards === 1 ? "" : "s"}`
      : `Rolls ${d.min_rewards}-${d.max_rewards} rewards`;
  const summary = `${rollDesc} using ${SELECTION_LABELS[d.selection_method]}.${d.guaranteed_first ? " Guaranteed rewards are granted first." : ""} Duplicates ${d.allow_duplicates ? "enabled" : "disabled"}.${d.quantity_multiplier !== 1 ? ` Quantities scaled ×${d.quantity_multiplier}.` : ""}${d.min_total_quantity != null || d.max_total_quantity != null ? ` Total qty clamped to ${d.min_total_quantity ?? "—"}…${d.max_total_quantity ?? "—"}.` : ""}${!d.enabled ? " (Table disabled)" : ""}`;

  return (
    <div className="space-y-4">
      <div className="panel p-3 border-l-2 border-primary/50">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Rule Summary</p>
        <p className="text-xs">{summary}</p>
      </div>

      <div className="panel p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Roll Configuration</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Field label="Selection Method">
            <select className={inputCls} value={d.selection_method} onChange={(e) => setD({ ...d, selection_method: e.target.value as typeof d.selection_method })}>
              {Object.entries(SELECTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Minimum Rolls">
            <input type="number" min={0} className={inputCls} value={d.min_rewards} onChange={(e) => setD({ ...d, min_rewards: Number(e.target.value) })} />
          </Field>
          <Field label="Maximum Rolls">
            <input type="number" min={0} className={inputCls} value={d.max_rewards} onChange={(e) => setD({ ...d, max_rewards: Number(e.target.value) })} />
          </Field>
          <Field label="Fixed Roll Count (optional)">
            <input type="number" min={0} className={inputCls} value={d.fixed_roll_count ?? ""} placeholder="—" onChange={(e) => setD({ ...d, fixed_roll_count: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={d.enabled} onChange={(e) => setD({ ...d, enabled: e.target.checked })} /> Enabled
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={d.allow_duplicates} onChange={(e) => setD({ ...d, allow_duplicates: e.target.checked })} /> Allow Duplicates
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={d.guaranteed_first} onChange={(e) => setD({ ...d, guaranteed_first: e.target.checked })} /> Roll Guaranteed Rewards First
          </label>
        </div>
      </div>

      <div className="panel p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Quantity Rules</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <Field label="Quantity Multiplier">
            <input type="number" step="0.1" min={0} className={inputCls} value={d.quantity_multiplier} onChange={(e) => setD({ ...d, quantity_multiplier: Number(e.target.value) })} />
          </Field>
          <Field label="Minimum Total Quantity">
            <input type="number" min={0} className={inputCls} value={d.min_total_quantity ?? ""} placeholder="—" onChange={(e) => setD({ ...d, min_total_quantity: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Maximum Total Quantity">
            <input type="number" min={0} className={inputCls} value={d.max_total_quantity ?? ""} placeholder="—" onChange={(e) => setD({ ...d, max_total_quantity: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
        </div>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="space-y-1">
          {errors.map((m) => (
            <div key={m} className="flex items-start gap-2 rounded border border-destructive/50 bg-destructive/10 p-2 text-[11px] text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5" /> {m}
            </div>
          ))}
          {warnings.map((m) => (
            <div key={m} className="flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-600 dark:text-amber-400">
              <Info className="h-3.5 w-3.5 mt-0.5" /> {m}
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          disabled={errors.length > 0 || save.isPending}
          onClick={() => save.mutate()}
          className="btn-gold inline-flex items-center gap-1 px-4 py-2 text-xs disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {save.isPending ? "Saving…" : "Save Rules"}
        </button>
      </div>
    </div>
  );
}


// keep tree-shake happy
export { CheckCircle2 };
