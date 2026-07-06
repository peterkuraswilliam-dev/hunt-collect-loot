import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  Copy,
  Download,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Square,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import {
  progressionTypesQuery,
  xpSourceCategoriesQuery,
  xpSourcesQuery,
  type ProgressionType,
  type XPSource,
  type XPSourceCategory,
} from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const STATUSES = ["active", "draft", "archived"];
const PAGE_SIZE = 15;

type SortKey =
  | "name"
  | "category"
  | "base_xp"
  | "daily_cap"
  | "weekly_cap"
  | "status"
  | "updated_at";

type Draft = Partial<XPSource> & { id?: string };

const emptyDraft: Draft = {
  name: "",
  slug: "",
  description: "",
  category: "combat",
  progression_type_id: null,
  base_xp: 10,
  scaling_enabled: false,
  daily_cap: null,
  weekly_cap: null,
  cooldown_seconds: 0,
  min_level: 1,
  max_level: null,
  max_xp_per_action: null,
  icon: "⚡",
  color: "#f5b544",
  status: "active",
  enabled: true,
  visible: true,
  hidden: false,
  notes: "",
  display_order: 0,
  sort_order: 0,
  is_demo: false,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function XPSources() {
  const qc = useQueryClient();
  const { data: sources = [] } = useQuery(xpSourcesQuery);
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const { data: categories = [] } = useQuery(xpSourceCategoriesQuery);

  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fEnabled, setFEnabled] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sort_order" as SortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const catMap = useMemo(() => new Map(categories.map((c) => [c.slug, c])), [categories]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const out = sources.filter((s) => {
      if (q) {
        const hay = `${s.name} ${s.slug} ${s.description ?? ""} ${s.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fCategory && s.category !== fCategory) return false;
      if (fType && s.progression_type_id !== fType) return false;
      if (fStatus && s.status !== fStatus) return false;
      if (fEnabled === "on" && !s.enabled) return false;
      if (fEnabled === "off" && s.enabled) return false;
      return true;
    });
    out.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
    return out;
  }, [sources, search, fCategory, fType, fStatus, fEnabled, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const summary = useMemo(() => {
    const total = sources.length;
    const active = sources.filter((s) => s.enabled && s.status === "active").length;
    const disabled = total - active;
    const byCat = new Map<string, number>();
    const byType = new Map<string, number>();
    let highest = 0;
    let sum = 0;
    sources.forEach((s) => {
      byCat.set(s.category, (byCat.get(s.category) ?? 0) + 1);
      const t = s.progression_type_id ?? "unassigned";
      byType.set(t, (byType.get(t) ?? 0) + 1);
      if (s.base_xp > highest) highest = s.base_xp;
      sum += s.base_xp;
    });
    return {
      total,
      active,
      disabled,
      highest,
      avg: total > 0 ? Math.round(sum / total) : 0,
      byCat: [...byCat.entries()].sort((a, b) => b[1] - a[1]),
      byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [sources]);

  const save = useMutation({
    mutationFn: async (row: Draft) => {
      const errs: string[] = [];
      if (!row.name?.trim()) errs.push("Name required");
      if (!row.slug?.trim()) errs.push("Internal key required");
      if ((row.base_xp ?? 0) < 0) errs.push("Base XP cannot be negative");
      if (row.daily_cap != null && row.weekly_cap != null && row.weekly_cap < row.daily_cap)
        errs.push("Weekly cap must be >= daily cap");
      if (row.progression_type_id && !typeMap.has(row.progression_type_id))
        errs.push("Progression type invalid");
      // uniqueness check
      const dupe = sources.find((s) => s.slug === row.slug && s.id !== row.id);
      if (dupe) errs.push("Internal key must be unique");
      setErrors(errs);
      if (errs.length) throw new Error(errs.join("; "));

      const payload = { ...row };
      delete payload.id;
      if (row.id) {
        const { error } = await sb.from("xp_sources").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("xp_sources").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xp_sources"] });
      setEditing(null);
      setErrors([]);
      toast.success("XP source saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await sb.from("xp_sources").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xp_sources"] });
      setSelected(new Set());
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkPatch = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Record<string, unknown> }) => {
      const { error } = await sb.from("xp_sources").update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xp_sources"] });
      setSelected(new Set());
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (ids: string[]) => {
      const rows = sources.filter((s) => ids.includes(s.id));
      const copies = rows.map((r) => {
        const c = { ...r } as Record<string, unknown>;
        delete c.id;
        delete c.created_at;
        delete c.updated_at;
        c.name = `${r.name} (copy)`;
        c.slug = `${r.slug}_copy_${Math.floor(Math.random() * 1e5)}`;
        c.status = "draft";
        c.enabled = false;
        return c;
      });
      const { error } = await sb.from("xp_sources").insert(copies);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["xp_sources"] });
      toast.success("Duplicated as drafts");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xp_sources_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const rows = JSON.parse(text) as Record<string, unknown>[];
      const clean = rows.map((r) => {
        const c = { ...r };
        delete c.id;
        delete c.created_at;
        delete c.updated_at;
        return c;
      });
      const { error } = await sb.from("xp_sources").insert(clean);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["xp_sources"] });
      toast.success(`Imported ${clean.length} sources`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };
  const sortIcon = (k: SortKey) =>
    sortKey !== k ? (
      <ArrowUpDown className="inline h-3 w-3 opacity-40" />
    ) : sortDir === "asc" ? (
      <ArrowUp className="inline h-3 w-3" />
    ) : (
      <ArrowDown className="inline h-3 w-3" />
    );

  const allChecked = paged.length > 0 && paged.every((r) => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) paged.forEach((r) => next.delete(r.id));
    else paged.forEach((r) => next.add(r.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-4">
      {/* Summary panel */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <StatCard label="Total" value={summary.total} />
        <StatCard label="Active" value={summary.active} tone="emerald" />
        <StatCard label="Disabled" value={summary.disabled} tone="muted" />
        <StatCard label="Categories" value={summary.byCat.length} />
        <StatCard label="Highest XP" value={summary.highest.toLocaleString()} />
        <StatCard label="Avg XP" value={summary.avg.toLocaleString()} />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Sources by Category
          </div>
          <div className="flex flex-wrap gap-1">
            {summary.byCat.map(([slug, n]) => {
              const c = catMap.get(slug);
              return (
                <span
                  key={slug}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px]"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: c?.color ?? "#666" }} />
                  {c?.label ?? slug}
                  <span className="text-muted-foreground">· {n}</span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Sources by Progression Type
          </div>
          <div className="flex flex-wrap gap-1">
            {summary.byType.map(([id, n]) => {
              const t = id === "unassigned" ? null : typeMap.get(id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px]"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: (t as ProgressionType | undefined)?.color ?? "#555" }}
                  />
                  {(t as ProgressionType | undefined)?.name ?? "Unassigned"}
                  <span className="text-muted-foreground">· {n}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="panel space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search name, key, description, notes…"
              className={`${inputCls} pl-8`}
            />
          </div>
          <select
            value={fCategory}
            onChange={(e) => {
              setFCategory(e.target.value);
              setPage(0);
            }}
            className={inputCls + " w-auto"}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={fType}
            onChange={(e) => {
              setFType(e.target.value);
              setPage(0);
            }}
            className={inputCls + " w-auto"}
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value)}
            className={inputCls + " w-auto"}
          >
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={fEnabled}
            onChange={(e) => setFEnabled(e.target.value)}
            className={inputCls + " w-auto"}
          >
            <option value="">Any state</option>
            <option value="on">Enabled</option>
            <option value="off">Disabled</option>
          </select>
          <button
            onClick={() => setEditing({ ...emptyDraft })}
            className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> New Source
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={exportJson}
            className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1"
          >
            <Download className="h-3 w-3" /> Export
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1">
            <Upload className="h-3 w-3" /> Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-muted-foreground">{selected.size} selected</span>
              <button
                onClick={() => bulkPatch.mutate({ ids: [...selected], patch: { enabled: true, status: "active" } })}
                className="rounded border border-border bg-surface-2 px-2 py-1"
              >
                Enable
              </button>
              <button
                onClick={() => bulkPatch.mutate({ ids: [...selected], patch: { enabled: false } })}
                className="rounded border border-border bg-surface-2 px-2 py-1"
              >
                Disable
              </button>
              <button
                onClick={() => bulkPatch.mutate({ ids: [...selected], patch: { status: "archived", enabled: false } })}
                className="rounded border border-border bg-surface-2 px-2 py-1"
              >
                Archive
              </button>
              <button
                onClick={() => duplicate.mutate([...selected])}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1"
              >
                <Copy className="h-3 w-3" /> Duplicate
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete ${selected.size} XP sources?`)) del.mutate([...selected]);
                }}
                className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <AdminTable<XPSource & { id: string }>
        rows={paged}
        empty="No XP sources yet. Create one to get started."
        columns={[
          {
            key: "check",
            label: (
              <button onClick={toggleAll}>
                {allChecked ? (
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            ) as unknown as string,
            render: (r) => (
              <button onClick={() => toggleOne(r.id)}>
                {selected.has(r.id) ? (
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            ),
          },
          {
            key: "name",
            label: (
              <button onClick={() => toggleSort("name")}>Name {sortIcon("name")}</button>
            ) as unknown as string,
            render: (r) => (
              <div className="flex items-center gap-2">
                <span className="text-base" style={{ color: r.color }}>
                  {r.icon ?? "⚡"}
                </span>
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-[10px] text-muted-foreground">{r.slug}</div>
                </div>
              </div>
            ),
          },
          {
            key: "description",
            label: "Description",
            render: (r) => (
              <span className="line-clamp-1 text-muted-foreground">{r.description ?? "—"}</span>
            ),
          },
          {
            key: "category",
            label: (
              <button onClick={() => toggleSort("category")}>Category {sortIcon("category")}</button>
            ) as unknown as string,
            render: (r) => {
              const c = catMap.get(r.category);
              return (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: c?.color ?? "#666" }} />
                  {c?.label ?? r.category}
                </span>
              );
            },
          },
          {
            key: "type",
            label: "Progression",
            render: (r) => {
              const t = r.progression_type_id ? typeMap.get(r.progression_type_id) : undefined;
              return t ? (
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: (t as ProgressionType).color }}
                  />
                  {(t as ProgressionType).name}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              );
            },
          },
          {
            key: "base_xp",
            label: (
              <button onClick={() => toggleSort("base_xp")}>Base XP {sortIcon("base_xp")}</button>
            ) as unknown as string,
            render: (r) => (
              <span className="font-mono">
                {r.base_xp.toLocaleString()}
                {r.scaling_enabled && <span className="ml-1 text-[10px] text-primary">×</span>}
              </span>
            ),
          },
          {
            key: "daily",
            label: (
              <button onClick={() => toggleSort("daily_cap")}>Daily {sortIcon("daily_cap")}</button>
            ) as unknown as string,
            render: (r) => (
              <span className="text-muted-foreground">{r.daily_cap?.toLocaleString() ?? "—"}</span>
            ),
          },
          {
            key: "weekly",
            label: (
              <button onClick={() => toggleSort("weekly_cap")}>Weekly {sortIcon("weekly_cap")}</button>
            ) as unknown as string,
            render: (r) => (
              <span className="text-muted-foreground">{r.weekly_cap?.toLocaleString() ?? "—"}</span>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <div className="flex items-center gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    r.status === "active"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : r.status === "draft"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.status}
                </span>
                {!r.enabled && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                    off
                  </span>
                )}
                {r.visible ? (
                  <Eye className="h-3 w-3 text-emerald-400" />
                ) : (
                  <EyeOff className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            ),
          },
          {
            key: "updated",
            label: (
              <button onClick={() => toggleSort("updated_at")}>Updated {sortIcon("updated_at")}</button>
            ) as unknown as string,
            render: (r) => (
              <span className="text-[10px] text-muted-foreground">
                {new Date(r.updated_at).toLocaleDateString()}
              </span>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (r) => (
              <button
                onClick={() => setEditing(r)}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1 text-[10px]"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
            ),
          },
        ]}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {filtered.length} of {sources.length} sources
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border border-border bg-surface-2 px-2 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            {page + 1} / {pageCount}
          </span>
          <button
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="rounded border border-border bg-surface-2 px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {editing && (
        <EditorDialog
          draft={editing}
          setDraft={setEditing}
          onSave={() => save.mutate(editing)}
          onClose={() => {
            setEditing(null);
            setErrors([]);
          }}
          errors={errors}
          categories={categories}
          types={types}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "emerald" | "muted";
}) {
  const cls =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-primary";
  return (
    <div className="panel p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-lg font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function EditorDialog({
  draft,
  setDraft,
  onSave,
  onClose,
  errors,
  categories,
  types,
  saving,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onClose: () => void;
  errors: string[];
  categories: XPSourceCategory[];
  types: ProgressionType[];
  saving: boolean;
}) {
  const patch = (p: Partial<Draft>) => setDraft({ ...draft, ...p });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="panel max-h-[90vh] w-full max-w-3xl overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-bold">
              {draft.id ? "Edit XP Source" : "New XP Source"}
            </h3>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="mb-3 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {errors.map((e) => (
              <div key={e}>• {e}</div>
            ))}
          </div>
        )}

        <div className="space-y-4">
          <section>
            <SectionTitle>Basic Information</SectionTitle>
            <div className="grid gap-2 md:grid-cols-2">
              <Field label="Name">
                <input
                  className={inputCls}
                  value={draft.name ?? ""}
                  onChange={(e) => {
                    const name = e.target.value;
                    patch({
                      name,
                      slug: draft.id || draft.slug ? draft.slug : slugify(name),
                    });
                  }}
                />
              </Field>
              <Field label="Internal Key">
                <input
                  className={inputCls}
                  value={draft.slug ?? ""}
                  onChange={(e) => patch({ slug: slugify(e.target.value) })}
                />
              </Field>
              <Field label="Description">
                <textarea
                  className={inputCls}
                  rows={2}
                  value={draft.description ?? ""}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Icon (emoji)">
                  <input
                    className={inputCls}
                    value={draft.icon ?? ""}
                    onChange={(e) => patch({ icon: e.target.value })}
                  />
                </Field>
                <Field label="Colour">
                  <input
                    type="color"
                    className={`${inputCls} h-10 p-1`}
                    value={draft.color ?? "#f5b544"}
                    onChange={(e) => patch({ color: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Category">
                <select
                  className={inputCls}
                  value={draft.category ?? ""}
                  onChange={(e) => patch({ category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  className={inputCls}
                  value={draft.status ?? "active"}
                  onChange={(e) => patch({ status: e.target.value })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>Progression</SectionTitle>
            <div className="grid gap-2 md:grid-cols-3">
              <Field label="Progression Type">
                <select
                  className={inputCls}
                  value={draft.progression_type_id ?? ""}
                  onChange={(e) => patch({ progression_type_id: e.target.value || null })}
                >
                  <option value="">— None —</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Base XP">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.base_xp ?? 0}
                  onChange={(e) => patch({ base_xp: Number(e.target.value) })}
                />
              </Field>
              <Field label="Scaling Enabled">
                <select
                  className={inputCls}
                  value={String(draft.scaling_enabled ?? false)}
                  onChange={(e) => patch({ scaling_enabled: e.target.value === "true" })}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
              <Field label="Minimum Level">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.min_level ?? 1}
                  onChange={(e) => patch({ min_level: Number(e.target.value) })}
                />
              </Field>
              <Field label="Maximum Level">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.max_level ?? ""}
                  onChange={(e) =>
                    patch({ max_level: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
              <Field label="Enabled">
                <select
                  className={inputCls}
                  value={String(draft.enabled ?? true)}
                  onChange={(e) => patch({ enabled: e.target.value === "true" })}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>Limits</SectionTitle>
            <div className="grid gap-2 md:grid-cols-4">
              <Field label="Daily Cap">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.daily_cap ?? ""}
                  onChange={(e) =>
                    patch({ daily_cap: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
              <Field label="Weekly Cap">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.weekly_cap ?? ""}
                  onChange={(e) =>
                    patch({ weekly_cap: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
              <Field label="Cooldown (s)">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.cooldown_seconds ?? 0}
                  onChange={(e) => patch({ cooldown_seconds: Number(e.target.value) })}
                />
              </Field>
              <Field label="Max XP / Action">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.max_xp_per_action ?? ""}
                  onChange={(e) =>
                    patch({ max_xp_per_action: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
            </div>
          </section>

          <section>
            <SectionTitle>Advanced</SectionTitle>
            <div className="grid gap-2 md:grid-cols-3">
              <Field label="Visible to Players">
                <select
                  className={inputCls}
                  value={String(draft.visible ?? true)}
                  onChange={(e) => patch({ visible: e.target.value === "true" })}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>
              <Field label="Hidden">
                <select
                  className={inputCls}
                  value={String(draft.hidden ?? false)}
                  onChange={(e) => patch({ hidden: e.target.value === "true" })}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
              <Field label="Display Order">
                <input
                  type="number"
                  className={inputCls}
                  value={draft.display_order ?? 0}
                  onChange={(e) => patch({ display_order: Number(e.target.value) })}
                />
              </Field>
              <div className="md:col-span-3">
                <Field label="Internal Notes">
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={draft.notes ?? ""}
                    onChange={(e) => patch({ notes: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border border-border bg-surface-2 px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-gold rounded px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-primary">
      {children}
    </div>
  );
}
