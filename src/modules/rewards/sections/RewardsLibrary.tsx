import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { rewardsQuery, rewardTypesQuery, type Reward } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const PAGE_SIZE = 25;

export function RewardsLibrary() {
  const qc = useQueryClient();
  const { data: rewards = [] } = useQuery(rewardsQuery);
  const { data: types = [] } = useQuery(rewardTypesQuery);
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<"all" | "yes" | "no">("all");
  const [sortBy, setSortBy] = useState<"created_at" | "name" | "quantity">("created_at");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Partial<Reward> | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = rewards.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !(r.description ?? "").toLowerCase().includes(q)) return false;
      if (typeFilter && r.reward_type_id !== typeFilter) return false;
      if (rarityFilter && r.rarity !== rarityFilter) return false;
      if (enabledFilter === "yes" && !r.enabled) return false;
      if (enabledFilter === "no" && r.enabled) return false;
      return true;
    });
    rows = rows.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "quantity") return b.quantity - a.quantity;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return rows;
  }, [rewards, search, typeFilter, rarityFilter, enabledFilter, sortBy]);

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
            onClick={() => setEditing({ enabled: true, quantity: 1, rarity: "common", tags: [], reward_type_id: types[0]?.id })}
            className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> New Reward
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-widest text-primary">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Rarity</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2">Tags</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {paginated.map((r) => {
                const t = typeById.get(r.reward_type_id);
                return (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]" style={{ background: (t?.color ?? "#8B5CF6") + "22", color: t?.color ?? "#8B5CF6" }}>
                        {t?.name ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 capitalize">{r.rarity}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.quantity}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.tags.join(", ") || "—"}</td>
                    <td className="px-3 py-2">{r.enabled ? <span className="text-primary">Active</span> : <span className="text-muted-foreground">Disabled</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => confirm(`Delete ${r.name}?`) && del.mutate(r.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>No rewards match.</td></tr>
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
          <div className="panel-gold w-full max-w-md space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
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
              <Field label="Icon (lucide name)"><input className={inputCls} value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></Field>
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
    </div>
  );
}
