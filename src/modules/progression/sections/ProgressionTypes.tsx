import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import {
  progressionEntityTypesQuery,
  progressionTypesQuery,
  xpCurvesQuery,
  type ProgressionType,
} from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type SortKey = "name" | "slug" | "category" | "entity_type" | "max_level" | "status" | "created_at" | "updated_at";
type Draft = Partial<ProgressionType> & { id?: string };

const CATEGORIES = ["general", "character", "combat", "crafting", "social", "economy", "seasonal"];
const STATUSES = ["active", "draft", "archived"];
const PAGE_SIZE = 10;

const emptyDraft: Draft = {
  name: "",
  slug: "",
  description: "",
  icon: "",
  color: "#f5b544",
  category: "general",
  entity_type: "player",
  status: "active",
  max_level: 100,
  starting_level: 1,
  starting_xp: 0,
  xp_display_name: "XP",
  visible: true,
  allow_overflow_xp: false,
  sort_order: 0,
  default_curve_id: null,
};

function slugify(v: string) {
  return v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function ProgressionTypes() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery(progressionTypesQuery);
  const { data: entityTypes = [] } = useQuery(progressionEntityTypesQuery);
  const { data: curves = [] } = useQuery(xpCurvesQuery);

  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fEntity, setFEntity] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sort_order" as SortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const out = rows.filter((r) => {
      if (q && !`${r.name} ${r.slug} ${r.description ?? ""}`.toLowerCase().includes(q)) return false;
      if (fCategory && r.category !== fCategory) return false;
      if (fEntity && r.entity_type !== fEntity) return false;
      if (fStatus && r.status !== fStatus) return false;
      return true;
    });
    out.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      const cmp = av == null ? -1 : bv == null ? 1 : av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [rows, search, fCategory, fEntity, fStatus, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const save = useMutation({
    mutationFn: async (draft: Draft) => {
      const payload = { ...draft };
      if (!payload.slug && payload.name) payload.slug = slugify(payload.name);
      const { id, created_at: _c, updated_at: _u, ...rest } = payload;
      if (id) {
        const { error } = await sb.from("progression_types").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("progression_types").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progression_types"] });
      setEditing(null);
      setErrors([]);
      toast.success("Progression type saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await sb.from("progression_types").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      qc.invalidateQueries({ queryKey: ["progression_types"] });
      setSelected((s) => {
        const n = new Set(s);
        ids.forEach((id) => n.delete(id));
        return n;
      });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await sb.from("progression_types").update({ status }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progression_types"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function validate(d: Draft): string[] {
    const errs: string[] = [];
    if (!d.name?.trim()) errs.push("Name is required");
    const slug = d.slug?.trim() || (d.name ? slugify(d.name) : "");
    if (!slug) errs.push("Internal key (slug) is required");
    if (rows.some((r) => r.slug === slug && r.id !== d.id)) errs.push("Internal key must be unique");
    if (!d.max_level || d.max_level <= 0) errs.push("Maximum level must be greater than zero");
    if ((d.starting_level ?? 1) < 1 || (d.starting_level ?? 1) > (d.max_level ?? 0))
      errs.push("Starting level must be between 1 and maximum level");
    if ((d.starting_xp ?? 0) < 0) errs.push("Starting XP cannot be negative");
    return errs;
  }

  function submit() {
    if (!editing) return;
    const errs = validate(editing);
    setErrors(errs);
    if (errs.length) return;
    save.mutate(editing);
  }

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  function togglePage() {
    setSelected((s) => {
      const n = new Set(s);
      if (allOnPageSelected) pageRows.forEach((r) => n.delete(r.id));
      else pageRows.forEach((r) => n.add(r.id));
      return n;
    });
  }
  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const sortBtn = (k: SortKey, label: string) => (
    <button
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => {
        if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
          setSortKey(k);
          setSortDir("asc");
        }
      }}
    >
      {label}
      {sortKey === k ? (
        sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  );

  const selectedIds = Array.from(selected);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="panel flex flex-wrap items-center gap-2 p-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-7`}
            placeholder="Search name, slug, description"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <select className={`${inputCls} w-auto`} value={fCategory} onChange={(e) => { setFCategory(e.target.value); setPage(0); }}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={fEntity} onChange={(e) => { setFEntity(e.target.value); setPage(0); }}>
          <option value="">All entities</option>
          {entityTypes.map((e) => <option key={e.slug} value={e.slug}>{e.label}</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(0); }}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => { setEditing({ ...emptyDraft }); setErrors([]); }}
          className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> New Type
        </button>
      </div>

      {/* Bulk bar */}
      {selectedIds.length > 0 && (
        <div className="panel-gold flex flex-wrap items-center gap-2 p-2 text-xs">
          <span className="font-semibold">{selectedIds.length} selected</span>
          <button onClick={() => bulkStatus.mutate({ ids: selectedIds, status: "active" })} className="rounded border border-border bg-surface-2 px-2 py-1">Enable</button>
          <button onClick={() => bulkStatus.mutate({ ids: selectedIds, status: "archived" })} className="rounded border border-border bg-surface-2 px-2 py-1">Disable</button>
          <button
            onClick={() => confirm(`Delete ${selectedIds.length} type(s)?`) && del.mutate(selectedIds)}
            className="ml-auto rounded border border-destructive/60 bg-surface-2 px-2 py-1 text-destructive"
          >
            <Trash2 className="mr-1 inline h-3 w-3" /> Delete
          </button>
        </div>
      )}

      <AdminTable
        rows={pageRows}
        empty="No progression types match your filters."
        columns={[
          {
            key: "sel",
            label: "",
            className: "w-6",
            render: (r) => (
              <button onClick={() => toggleOne(r.id)} aria-label="select">
                {selected.has(r.id) ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
              </button>
            ),
          },
          {
            key: "icon",
            label: "",
            className: "w-8",
            render: (r) => (
              <span className="inline-grid h-6 w-6 place-items-center rounded" style={{ background: r.color, color: "#0b0b0b", fontSize: 12 }}>
                {r.icon?.slice(0, 2).toUpperCase() || r.name.slice(0, 1).toUpperCase()}
              </span>
            ),
          },
          { key: "name", label: sortBtn("name", "Name") as unknown as string, render: (r) => (
            <div>
              <div className="font-semibold">{r.name}</div>
              {r.description && <div className="text-[10px] text-muted-foreground line-clamp-1">{r.description}</div>}
            </div>
          ) },
          { key: "slug", label: sortBtn("slug", "Key") as unknown as string, render: (r) => <code className="text-[11px] text-muted-foreground">{r.slug}</code> },
          { key: "category", label: sortBtn("category", "Category") as unknown as string, render: (r) => <span className="capitalize">{r.category}</span> },
          { key: "entity_type", label: sortBtn("entity_type", "Entity") as unknown as string, render: (r) => (
            <span className="capitalize">{entityTypes.find((e) => e.slug === r.entity_type)?.label ?? r.entity_type}</span>
          ) },
          { key: "max_level", label: sortBtn("max_level", "Max Lvl") as unknown as string, render: (r) => r.max_level },
          { key: "status", label: sortBtn("status", "Status") as unknown as string, render: (r) => (
            <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${r.status === "active" ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted-foreground"}`}>
              {r.status}
            </span>
          ) },
          { key: "visible", label: "Player", render: (r) => r.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> },
          { key: "created_at", label: sortBtn("created_at", "Created") as unknown as string, render: (r) => new Date(r.created_at).toLocaleDateString() },
          { key: "updated_at", label: sortBtn("updated_at", "Updated") as unknown as string, render: (r) => new Date(r.updated_at).toLocaleDateString() },
          {
            key: "actions", label: "", className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button onClick={() => { setEditing(r); setErrors([]); }} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => confirm("Delete?") && del.mutate([r.id])} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
      />

      {/* Header row select-all + pagination */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <button onClick={togglePage} className="inline-flex items-center gap-1 hover:text-foreground">
          {allOnPageSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
          Select page
        </button>
        <div className="flex items-center gap-2">
          <span>{filtered.length} results · page {page + 1}/{pageCount}</span>
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="rounded border border-border px-2 py-0.5 disabled:opacity-40">Prev</button>
          <button disabled={page + 1 >= pageCount} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} className="rounded border border-border px-2 py-0.5 disabled:opacity-40">Next</button>
        </div>
      </div>

      {/* Editor Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-2xl space-y-3 overflow-y-auto p-4 max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">
                {editing.id ? "Edit Progression Type" : "New Progression Type"}
              </h3>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Basic Info</span>
            </div>

            {errors.length > 0 && (
              <ul className="rounded border border-destructive/60 bg-destructive/10 p-2 text-xs text-destructive">
                {errors.map((e) => <li key={e}>• {e}</li>)}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Field label="Name">
                <input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value, slug: editing.slug || slugify(e.target.value) })} />
              </Field>
              <Field label="Internal Key (slug)">
                <input className={inputCls} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: slugify(e.target.value) })} />
              </Field>
              <Field label="Category">
                <select className={inputCls} value={editing.category ?? "general"} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inputCls} value={editing.status ?? "active"} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Icon (label / emoji)">
                <input className={inputCls} value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
              </Field>
              <Field label="Colour">
                <input type="color" className={`${inputCls} h-10 p-1`} value={editing.color ?? "#f5b544"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              </Field>
            </div>

            <Field label="Description">
              <textarea className={inputCls} rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>

            <div className="flex items-center justify-between border-t border-border/40 pt-2">
              <span className="text-[10px] uppercase tracking-widest text-primary">Configuration</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Assigned Entity">
                <select className={inputCls} value={editing.entity_type ?? "player"} onChange={(e) => setEditing({ ...editing, entity_type: e.target.value })}>
                  {entityTypes.map((et) => <option key={et.slug} value={et.slug}>{et.label}</option>)}
                </select>
              </Field>
              <Field label="Default XP Curve">
                <select className={inputCls} value={editing.default_curve_id ?? ""} onChange={(e) => setEditing({ ...editing, default_curve_id: e.target.value || null })}>
                  <option value="">— none —</option>
                  {curves.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Maximum Level">
                <input type="number" min={1} className={inputCls} value={editing.max_level ?? 100} onChange={(e) => setEditing({ ...editing, max_level: Number(e.target.value) })} />
              </Field>
              <Field label="Starting Level">
                <input type="number" min={1} className={inputCls} value={editing.starting_level ?? 1} onChange={(e) => setEditing({ ...editing, starting_level: Number(e.target.value) })} />
              </Field>
              <Field label="Starting XP">
                <input type="number" min={0} className={inputCls} value={editing.starting_xp ?? 0} onChange={(e) => setEditing({ ...editing, starting_xp: Number(e.target.value) })} />
              </Field>
              <Field label="XP Display Name">
                <input className={inputCls} value={editing.xp_display_name ?? "XP"} onChange={(e) => setEditing({ ...editing, xp_display_name: e.target.value })} />
              </Field>
              <Field label="Display Order">
                <input type="number" className={inputCls} value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
              </Field>
              <Field label="Visible to Players">
                <select className={inputCls} value={String(editing.visible ?? true)} onChange={(e) => setEditing({ ...editing, visible: e.target.value === "true" })}>
                  <option value="true">Visible</option>
                  <option value="false">Hidden</option>
                </select>
              </Field>
              <Field label="Allow Overflow XP">
                <select className={inputCls} value={String(editing.allow_overflow_xp ?? false)} onChange={(e) => setEditing({ ...editing, allow_overflow_xp: e.target.value === "true" })}>
                  <option value="false">No — cap at max level</option>
                  <option value="true">Yes — accumulate past max</option>
                </select>
              </Field>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={save.isPending} onClick={submit} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
