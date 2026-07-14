import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Search, X, GripVertical, Info, Layers, LineChart, Activity,
  Package, TrendingUp, Calendar, User, ExternalLink, Dices,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import {
  lootTablesQuery, lootSourceTypesQuery, lootTableEntriesQuery,
  lootTableReferencesQuery, lootTableActivityQuery, rewardsQuery,
  type LootTable, type LootTableEntry,
} from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Tab = "overview" | "entries" | "rules" | "references" | "analytics" | "activity";
const TABS: Array<{ key: Tab; label: string; icon: typeof Info }> = [
  { key: "overview", label: "Overview", icon: Info },
  { key: "entries", label: "Loot Entries", icon: Layers },
  { key: "rules", label: "Rules", icon: Dices },
  { key: "references", label: "References", icon: Package },
  { key: "analytics", label: "Analytics", icon: LineChart },
  { key: "activity", label: "Activity", icon: Activity },
];

type EntryDraft = Omit<LootTableEntry, "id" | "loot_table_id" | "times_awarded"> & { id?: string; _tmpId: string; times_awarded?: number };

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function LootTables() {
  const qc = useQueryClient();
  const { data: tables = [] } = useQuery(lootTablesQuery);
  const { data: sources = [] } = useQuery(lootSourceTypesQuery);
  const { data: rewards = [] } = useQuery(rewardsQuery);

  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const rewardById = useMemo(() => new Map(rewards.map((r) => [r.id, r])), [rewards]);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<"all" | "yes" | "no">("all");
  const [editing, setEditing] = useState<Partial<LootTable> | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [entries, setEntries] = useState<EntryDraft[]>([]);
  const [loadedFor, setLoadedFor] = useState<string>("");
  const [addRewardSearch, setAddRewardSearch] = useState("");

  const { data: loadedEntries = [] } = useQuery(lootTableEntriesQuery(editing?.id ?? null));
  const { data: refs = [] } = useQuery(lootTableReferencesQuery(editing?.id ?? null));
  const { data: activity = [] } = useQuery(lootTableActivityQuery(editing?.id ?? null));

  const loadedKey = editing?.id ?? "";
  if (loadedKey && loadedKey !== loadedFor) {
    setLoadedFor(loadedKey);
    setEntries(loadedEntries.map((e) => ({ ...e, _tmpId: e.id })));
  }
  if (!loadedKey && loadedFor) setLoadedFor("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !(t.description ?? "").toLowerCase().includes(q)) return false;
      if (sourceFilter && t.source_type_id !== sourceFilter) return false;
      if (enabledFilter === "yes" && !t.enabled) return false;
      if (enabledFilter === "no" && t.enabled) return false;
      return true;
    });
  }, [tables, search, sourceFilter, enabledFilter]);

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<LootTable> & { _entries?: EntryDraft[] }) => {
      const { _entries, ...t } = payload;
      const row = {
        slug: t.slug || slugify(t.name || "loot"),
        internal_id: t.internal_id ?? null,
        name: t.name,
        description: t.description ?? null,
        category: t.category ?? null,
        source_type_id: t.source_type_id ?? null,
        enabled: t.enabled ?? true,
        tags: t.tags ?? [],
        min_rewards: t.min_rewards ?? 1,
        max_rewards: t.max_rewards ?? 1,
        allow_duplicates: t.allow_duplicates ?? false,
        guaranteed_first: t.guaranteed_first ?? true,
        weighted_random: t.weighted_random ?? true,
      };
      let id = t.id;
      if (id) {
        const { error } = await sb.from("loot_tables").update(row).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("loot_tables").insert(row).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (_entries) {
        await sb.from("loot_table_entries").delete().eq("loot_table_id", id);
        if (_entries.length) {
          const rows = _entries.map((e, i) => ({
            loot_table_id: id, reward_id: e.reward_id, weight: e.weight,
            drop_chance: e.drop_chance, min_quantity: e.min_quantity,
            max_quantity: e.max_quantity, guaranteed: e.guaranteed,
            enabled: e.enabled, display_order: i,
          }));
          const { error } = await sb.from("loot_table_entries").insert(rows);
          if (error) throw error;
        }
      }
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loot_tables"] });
      qc.invalidateQueries({ queryKey: ["loot_table_entries"] });
      qc.invalidateQueries({ queryKey: ["loot_table_entries_all"] });
      setEditing(null);
      setEntries([]);
    },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("loot_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loot_tables"] }),
  });

  const addEntry = (rewardId: string) => {
    const r = rewardById.get(rewardId);
    if (!r) return;
    setEntries((prev) => [
      ...prev,
      {
        _tmpId: crypto.randomUUID(),
        reward_id: rewardId, weight: 10, drop_chance: 10, min_quantity: 1,
        max_quantity: 1, guaranteed: false, enabled: true, display_order: prev.length,
      },
    ]);
    setAddRewardSearch("");
  };

  const move = (idx: number, dir: -1 | 1) => {
    setEntries((prev) => {
      const n = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= n.length) return prev;
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });
  };

  const rewardOptions = rewards
    .filter((r) => r.enabled && !r.archived_at)
    .filter((r) => !addRewardSearch || r.name.toLowerCase().includes(addRewardSearch.toLowerCase()))
    .slice(0, 12);

  const totalWeight = entries.reduce((s, e) => s + (e.enabled ? e.weight : 0), 0) || 1;

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-center gap-2 p-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inputCls} pl-7`} placeholder="Search loot tables…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={inputCls} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">All sources</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={inputCls} value={enabledFilter} onChange={(e) => setEnabledFilter(e.target.value as "all" | "yes" | "no")}>
          <option value="all">All</option><option value="yes">Enabled</option><option value="no">Disabled</option>
        </select>
        <button className="btn btn-primary" onClick={() => { setEditing({ enabled: true, min_rewards: 1, max_rewards: 1, weighted_random: true, guaranteed_first: true, tags: [] }); setEntries([]); setTab("overview"); }}>
          <Plus className="h-3.5 w-3.5" /> New Loot Table
        </button>
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-widest text-primary">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Rules</th>
              <th className="px-3 py-2">Rolls</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-surface-2/40">
                <td className="px-3 py-2">
                  <button className="text-left font-semibold hover:underline" onClick={() => { setEditing(t); setTab("overview"); }}>{t.name}</button>
                  <div className="text-[10px] text-muted-foreground">{t.internal_id ?? t.slug}</div>
                </td>
                <td className="px-3 py-2">{t.source_type_id ? sourceById.get(t.source_type_id)?.name ?? "—" : "—"}</td>
                <td className="px-3 py-2">{t.category ?? "—"}</td>
                <td className="px-3 py-2 tabular-nums">{t.min_rewards}–{t.max_rewards}</td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{t.total_rolls.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${t.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/40 text-muted-foreground"}`}>
                    {t.enabled ? "Enabled" : "Disabled"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <button className="btn btn-ghost" onClick={() => { setEditing(t); setTab("overview"); }}><Pencil className="h-3 w-3" /></button>
                  <button className="btn btn-ghost text-red-400" onClick={() => { if (confirm(`Delete loot table "${t.name}"?`)) delMut.mutate(t.id); }}><Trash2 className="h-3 w-3" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No loot tables yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="flex h-full w-full max-w-3xl flex-col bg-surface-1">
            <div className="flex items-center justify-between border-b border-border p-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-primary">Loot Table</div>
                <div className="font-display text-lg font-extrabold">{editing.name ?? "New Loot Table"}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => { setEditing(null); setEntries([]); }}><X className="h-4 w-4" /></button>
            </div>

            <div className="flex gap-1 border-b border-border px-2">
              {TABS.map((tb) => (
                <button key={tb.key} onClick={() => setTab(tb.key)}
                  className={`flex items-center gap-1 px-3 py-2 text-xs ${tab === tb.key ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
                  <tb.icon className="h-3 w-3" /> {tb.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {tab === "overview" && (
                <div className="space-y-2">
                  <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Internal ID"><input className={inputCls} value={editing.internal_id ?? ""} onChange={(e) => setEditing({ ...editing, internal_id: e.target.value })} /></Field>
                    <Field label="Slug"><input className={inputCls} value={editing.slug ?? ""} placeholder="auto from name" onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
                  </div>
                  <Field label="Description"><textarea className={inputCls} rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Category"><input className={inputCls} value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></Field>
                    <Field label="Source Type">
                      <select className={inputCls} value={editing.source_type_id ?? ""} onChange={(e) => setEditing({ ...editing, source_type_id: e.target.value || null })}>
                        <option value="">—</option>
                        {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Tags (comma-separated)">
                    <input className={inputCls} value={(editing.tags ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                  </Field>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={editing.enabled ?? true} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> Enabled
                  </label>
                </div>
              )}

              {tab === "entries" && (
                <div className="space-y-3">
                  <div className="panel p-2">
                    <div className="mb-1 text-[10px] uppercase tracking-widest text-primary">Add reward</div>
                    <input className={inputCls} placeholder="Search Rewards Library…" value={addRewardSearch} onChange={(e) => setAddRewardSearch(e.target.value)} />
                    {addRewardSearch && (
                      <ul className="mt-1 max-h-48 overflow-y-auto text-xs">
                        {rewardOptions.map((r) => (
                          <li key={r.id}>
                            <button className="w-full px-2 py-1 text-left hover:bg-surface-2" onClick={() => addEntry(r.id)}>
                              {r.name} <span className="text-muted-foreground">· {r.rarity}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="panel overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-surface-2 text-[10px] uppercase text-primary">
                        <tr>
                          <th className="w-8"></th>
                          <th className="px-2 py-2">Reward</th>
                          <th className="px-2 py-2">Weight</th>
                          <th className="px-2 py-2">Chance %</th>
                          <th className="px-2 py-2">Min</th>
                          <th className="px-2 py-2">Max</th>
                          <th className="px-2 py-2">Guar.</th>
                          <th className="px-2 py-2">On</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e, i) => {
                          const r = rewardById.get(e.reward_id);
                          return (
                            <tr key={e._tmpId} className="border-b border-border/40 last:border-0">
                              <td className="px-1">
                                <div className="flex flex-col">
                                  <button className="text-muted-foreground hover:text-primary" onClick={() => move(i, -1)}>▲</button>
                                  <button className="text-muted-foreground hover:text-primary" onClick={() => move(i, 1)}>▼</button>
                                </div>
                              </td>
                              <td className="px-2 py-1">
                                <div className="font-semibold">{r?.name ?? "—"}</div>
                                <div className="text-[10px] text-muted-foreground">{((e.enabled ? e.weight : 0) / totalWeight * 100).toFixed(1)}% roll</div>
                              </td>
                              <td className="px-2 py-1"><input type="number" className={`${inputCls} w-16`} value={e.weight} onChange={(ev) => setEntries((p) => p.map((x, ix) => ix === i ? { ...x, weight: Number(ev.target.value) } : x))} /></td>
                              <td className="px-2 py-1"><input type="number" step="0.01" className={`${inputCls} w-20`} value={e.drop_chance} onChange={(ev) => setEntries((p) => p.map((x, ix) => ix === i ? { ...x, drop_chance: Number(ev.target.value) } : x))} /></td>
                              <td className="px-2 py-1"><input type="number" className={`${inputCls} w-14`} value={e.min_quantity} onChange={(ev) => setEntries((p) => p.map((x, ix) => ix === i ? { ...x, min_quantity: Number(ev.target.value) } : x))} /></td>
                              <td className="px-2 py-1"><input type="number" className={`${inputCls} w-14`} value={e.max_quantity} onChange={(ev) => setEntries((p) => p.map((x, ix) => ix === i ? { ...x, max_quantity: Number(ev.target.value) } : x))} /></td>
                              <td className="px-2 py-1 text-center"><input type="checkbox" checked={e.guaranteed} onChange={(ev) => setEntries((p) => p.map((x, ix) => ix === i ? { ...x, guaranteed: ev.target.checked } : x))} /></td>
                              <td className="px-2 py-1 text-center"><input type="checkbox" checked={e.enabled} onChange={(ev) => setEntries((p) => p.map((x, ix) => ix === i ? { ...x, enabled: ev.target.checked } : x))} /></td>
                              <td className="px-2 py-1"><button className="btn btn-ghost text-red-400" onClick={() => setEntries((p) => p.filter((_, ix) => ix !== i))}><Trash2 className="h-3 w-3" /></button></td>
                            </tr>
                          );
                        })}
                        {entries.length === 0 && <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">No entries. Add rewards above.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === "rules" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Minimum rewards granted"><input type="number" className={inputCls} value={editing.min_rewards ?? 1} onChange={(e) => setEditing({ ...editing, min_rewards: Number(e.target.value) })} /></Field>
                    <Field label="Maximum rewards granted"><input type="number" className={inputCls} value={editing.max_rewards ?? 1} onChange={(e) => setEditing({ ...editing, max_rewards: Number(e.target.value) })} /></Field>
                  </div>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editing.allow_duplicates ?? false} onChange={(e) => setEditing({ ...editing, allow_duplicates: e.target.checked })} /> Allow duplicate rewards</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editing.guaranteed_first ?? true} onChange={(e) => setEditing({ ...editing, guaranteed_first: e.target.checked })} /> Roll guaranteed rewards first</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editing.weighted_random ?? true} onChange={(e) => setEditing({ ...editing, weighted_random: e.target.checked })} /> Use weighted random selection</label>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editing.enabled ?? true} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> Enabled</label>
                  <p className="text-[10px] text-muted-foreground">Configuration only — distribution engine not yet implemented.</p>
                </div>
              )}

              {tab === "references" && (
                <div className="panel overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-surface-2 text-[10px] uppercase text-primary">
                      <tr><th className="px-3 py-2">Module</th><th className="px-3 py-2">Record</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Last updated</th><th></th></tr>
                    </thead>
                    <tbody>
                      {refs.map((r) => (
                        <tr key={r.id} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-2 capitalize">{r.module}</td>
                          <td className="px-3 py-2 font-semibold">{r.record_name}</td>
                          <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] ${r.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/40 text-muted-foreground"}`}>{r.status}</span></td>
                          <td className="px-3 py-2 text-muted-foreground">{new Date(r.last_updated).toLocaleDateString()}</td>
                          <td className="px-3 py-2 text-right"><button className="btn btn-ghost" title="Open"><ExternalLink className="h-3 w-3" /></button></td>
                        </tr>
                      ))}
                      {refs.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Not referenced by any module.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === "analytics" && (() => {
                const rolls = editing.total_rolls ?? 0;
                const granted = editing.total_rewards_granted ?? 0;
                const sorted = [...entries].sort((a, b) => (b.times_awarded ?? 0) - (a.times_awarded ?? 0));
                const most = sorted[0]; const least = sorted[sorted.length - 1];
                const weights = entries.map((e) => e.weight);
                const hi = Math.max(0, ...weights); const lo = weights.length ? Math.min(...weights) : 0;
                const avg = rolls ? (granted / rolls).toFixed(2) : "—";
                return (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Stat icon={TrendingUp} label="Total rolls" value={rolls.toLocaleString()} />
                    <Stat icon={Layers} label="Rewards granted" value={granted.toLocaleString()} />
                    <Stat icon={LineChart} label="Avg per roll" value={avg} />
                    <Stat icon={TrendingUp} label="Most awarded" value={most ? rewardById.get(most.reward_id)?.name ?? "—" : "—"} />
                    <Stat icon={TrendingUp} label="Least awarded" value={least ? rewardById.get(least.reward_id)?.name ?? "—" : "—"} />
                    <Stat icon={Dices} label="Weight range" value={weights.length ? `${lo} – ${hi}` : "—"} />
                  </div>
                );
              })()}

              {tab === "activity" && (
                <ul className="space-y-1 text-xs">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                      <span className="flex items-center gap-2"><Calendar className="h-3 w-3 text-muted-foreground" /><span className="font-semibold capitalize">{a.action.replace(/_/g, " ")}</span></span>
                      <span className="flex items-center gap-2 text-muted-foreground"><User className="h-3 w-3" />{a.actor_label ?? a.actor_id?.slice(0, 8) ?? "system"} · {new Date(a.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                  {activity.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border p-3">
              <button className="btn btn-ghost" onClick={() => { setEditing(null); setEntries([]); }}>Cancel</button>
              <button className="btn btn-primary" disabled={!editing.name || saveMut.isPending}
                onClick={() => saveMut.mutate({ ...editing, _entries: entries })}>
                {saveMut.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Info; label: string; value: string | number }) {
  return (
    <div className="panel flex items-center gap-2 p-3">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-display text-sm font-extrabold truncate max-w-[180px]">{value}</div>
      </div>
    </div>
  );
}
