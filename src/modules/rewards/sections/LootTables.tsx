import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Search, Package, CheckCircle2, Clock, Layers, ListTree } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import { LootTableDetail } from "../components/LootTableDetail";
import { allLootTableEntriesQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type SourceType = { id: string; slug: string; name: string; enabled: boolean; sort_order: number };
type LootTable = {
  id: string;
  slug: string;
  internal_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  source_type_id: string | null;
  enabled: boolean;
  allow_duplicates: boolean;
  tags: string[];
  updated_at: string;
};

const CATEGORIES = ["profession", "combat", "quest", "event", "login", "collection", "pve", "pvp", "special"];

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function LootTables() {
  const qc = useQueryClient();
  const { data: sources = [] } = useQuery({
    queryKey: ["loot_source_types"],
    queryFn: async () => {
      const { data, error } = await sb.from("loot_source_types").select("*").order("sort_order");
      if (error) throw error;
      return data as SourceType[];
    },
  });
  const { data: tables = [] } = useQuery({
    queryKey: ["loot_tables"],
    queryFn: async () => {
      const { data, error } = await sb.from("loot_tables").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as LootTable[];
    },
  });

  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [editing, setEditing] = useState<Partial<LootTable> | null>(null);
  const [manageSources, setManageSources] = useState(false);
  const [openTable, setOpenTable] = useState<LootTable | null>(null);

  const { data: allEntries = [] } = useQuery(allLootTableEntriesQuery);
  const entriesByTable = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of allEntries) m.set(e.loot_table_id, (m.get(e.loot_table_id) ?? 0) + 1);
    return m;
  }, [allEntries]);

  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const filtered = useMemo(() => {
    return tables.filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterSource && t.source_type_id !== filterSource) return false;
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterStatus === "enabled" && !t.enabled) return false;
      if (filterStatus === "disabled" && t.enabled) return false;
      return true;
    });
  }, [tables, search, filterSource, filterCategory, filterStatus]);

  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

  const stats = useMemo(() => {
    const bySource = new Map<string, number>();
    for (const t of tables) {
      const key = t.source_type_id ?? "unassigned";
      bySource.set(key, (bySource.get(key) ?? 0) + 1);
    }
    return {
      total: tables.length,
      active: tables.filter((t) => t.enabled).length,
      bySource,
      recent: [...tables].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5),
    };
  }, [tables]);

  const save = useMutation({
    mutationFn: async (row: Partial<LootTable>) => {
      const { id, ...rest } = row;
      const payload = {
        ...rest,
        slug: rest.slug || slugify(rest.name ?? ""),
        tags: Array.isArray(rest.tags) ? rest.tags : String(rest.tags ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (id) {
        const { error } = await sb.from("loot_tables").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("loot_tables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loot_tables"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("loot_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loot_tables"] }),
  });

  return (
    <div className="space-y-4">
      {/* Widgets */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Widget icon={<Package className="h-4 w-4" />} label="Total" value={stats.total} />
        <Widget icon={<CheckCircle2 className="h-4 w-4" />} label="Active" value={stats.active} />
        <Widget icon={<Layers className="h-4 w-4" />} label="Source Types" value={sources.length} />
        <Widget icon={<Clock className="h-4 w-4" />} label="Recently Updated" value={stats.recent.length} />
      </div>

      <div className="panel p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">By Source Type</p>
        <div className="flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <span key={s.id} className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px]">
              {s.name} <span className="text-muted-foreground">· {stats.bySource.get(s.id) ?? 0}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="panel flex flex-wrap items-center gap-2 p-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-7`}
            placeholder="Search loot tables…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className={inputCls + " w-auto"} value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setPage(1); }}>
          <option value="">All sources</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <button onClick={() => setManageSources(true)} className="rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold">
          Source Types
        </button>
        <button onClick={() => setEditing({ enabled: true, tags: [] })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Table
        </button>
      </div>

      <AdminTable
        rows={pageRows}
        empty="No loot tables match your filters."
        columns={[
          { key: "name", label: "Name", render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: "source", label: "Source", render: (r) => <span className="text-[11px] text-muted-foreground">{sourceById.get(r.source_type_id ?? "")?.name ?? "—"}</span> },
          { key: "category", label: "Category", render: (r) => <span className="text-[11px] text-muted-foreground">{r.category ?? "—"}</span> },
          { key: "status", label: "Status", render: (r) => (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${r.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {r.enabled ? "Active" : "Off"}
            </span>
          )},
          { key: "tags", label: "Tags", render: (r) => (
            <div className="flex flex-wrap gap-1">
              {(r.tags ?? []).slice(0, 3).map((t) => <span key={t} className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">{t}</span>)}
            </div>
          )},
          { key: "entries", label: "Entries", render: (r) => (
            <button onClick={() => setOpenTable(r)} className="rounded bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold hover:bg-primary/20 inline-flex items-center gap-1">
              <ListTree className="h-3 w-3" />{entriesByTable.get(r.id) ?? 0}
            </button>
          )},
          { key: "updated", label: "Updated", render: (r) => <span className="text-[11px] text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}</span> },
          { key: "actions", label: "", className: "text-right", render: (r) => (
            <div className="flex justify-end gap-1">
              <button onClick={() => setOpenTable(r)} className="rounded p-1 hover:bg-surface-2" title="Manage entries"><ListTree className="h-3.5 w-3.5" /></button>
              <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => confirm("Delete loot table?") && del.mutate(r.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          )},
        ]}
      />

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{filtered.length} table{filtered.length === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-1">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Prev</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-border px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-md space-y-3 overflow-y-auto p-4 max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Loot Table" : "New Loot Table"}</h3>
            <Field label="Name"><input className={inputCls} value={String(editing.name ?? "")} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Internal ID"><input className={inputCls} value={String(editing.internal_id ?? "")} onChange={(e) => setEditing({ ...editing, internal_id: e.target.value })} placeholder="lt_copper_vein" /></Field>
            <Field label="Description"><textarea className={inputCls} rows={2} value={String(editing.description ?? "")} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Source Type">
                <select className={inputCls} value={String(editing.source_type_id ?? "")} onChange={(e) => setEditing({ ...editing, source_type_id: e.target.value || null })}>
                  <option value="">— none —</option>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Category">
                <select className={inputCls} value={String(editing.category ?? "")} onChange={(e) => setEditing({ ...editing, category: e.target.value || null })}>
                  <option value="">— none —</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Tags (comma separated)">
              <input className={inputCls} value={(editing.tags ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </Field>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.enabled ?? true} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />
              Enabled
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={save.isPending || !editing.name} onClick={() => save.mutate(editing)} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">{save.isPending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {manageSources && <SourceTypesModal onClose={() => setManageSources(false)} sources={sources} />}
    </div>
  );
}

function Widget({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-widest">{label}</span></div>
      <p className="mt-1 font-display text-xl font-extrabold">{value}</p>
    </div>
  );
}

function SourceTypesModal({ onClose, sources }: { onClose: () => void; sources: SourceType[] }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<SourceType> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<SourceType>) => {
      const { id, ...rest } = row;
      const payload = { ...rest, slug: rest.slug || slugify(rest.name ?? "") };
      if (id) {
        const { error } = await sb.from("loot_source_types").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("loot_source_types").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loot_source_types"] }); setEditing(null); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("loot_source_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loot_source_types"] }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={onClose}>
      <div className="panel-gold w-full max-w-lg space-y-3 overflow-y-auto p-4 max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold">Source Types</h3>
          <button onClick={() => setEditing({ enabled: true, sort_order: sources.length })} className="btn-gold inline-flex items-center gap-1 px-2 py-1 text-xs"><Plus className="h-3 w-3" /> New</button>
        </div>
        <div className="space-y-1">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded border border-border bg-surface-2 px-2 py-1.5 text-xs">
              <div>
                <span className="font-semibold">{s.name}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">{s.slug}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(s)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3 w-3" /></button>
                <button onClick={() => confirm("Delete source type?") && del.mutate(s.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
        {editing && (
          <div className="space-y-2 rounded border border-primary/40 bg-surface-2 p-3">
            <Field label="Name"><input className={inputCls} value={String(editing.name ?? "")} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Slug"><input className={inputCls} value={String(editing.slug ?? "")} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="auto from name" /></Field>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.enabled ?? true} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />
              Enabled
            </label>
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded border border-border py-1.5 text-xs">Cancel</button>
              <button disabled={save.isPending || !editing.name} onClick={() => save.mutate(editing)} className="btn-gold flex-1 py-1.5 text-xs disabled:opacity-50">Save</button>
            </div>
          </div>
        )}
        <button onClick={onClose} className="w-full rounded border border-border py-1.5 text-xs">Close</button>
      </div>
    </div>
  );
}
