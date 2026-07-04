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
  Sparkles,
  Square,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import {
  progressionLevelsQuery,
  progressionTypesQuery,
  xpCurvesQuery,
  type ProgressionLevel,
  type ProgressionType,
  type XPCurve,
} from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type SortKey = "level_number" | "xp_required" | "xp_from_previous" | "title" | "status" | "updated_at";
type Draft = Partial<ProgressionLevel> & { id?: string };

const STATUSES = ["active", "draft", "archived"];
const PAGE_SIZE = 15;

const emptyDraft: Draft = {
  level_number: 1,
  xp_required: 0,
  xp_from_previous: 0,
  title: "",
  description: "",
  icon: "⭐",
  color: "#f5b544",
  notes: "",
  status: "active",
  display_order: 0,
  visible: true,
  hidden: false,
  is_demo: false,
};

function computeCurveXP(c: XPCurve | undefined, level: number): number {
  if (!c) return 0;
  const i = Math.max(1, level);
  const base = c.base_xp;
  const gm = c.growth_multiplier;
  const gf = c.growth_factor;
  const s = c.starting_xp;
  let v = 0;
  switch (c.growth_type) {
    case "linear": v = s + base * i * gf; break;
    case "exponential": v = s + base * Math.pow(gm, i - 1) * gf; break;
    case "soft_exponential": v = s + base * i * Math.pow(gm, Math.sqrt(i - 1)) * gf; break;
    case "logarithmic": v = s + base * gf * Math.log2(i + 1) * gm; break;
    case "polynomial": v = s + base * gf * Math.pow(i, gm); break;
    default: v = s + base * i * gf;
  }
  return Math.max(1, Math.floor(v));
}

export function Levels() {
  const qc = useQueryClient();
  const { data: allLevels = [] } = useQuery(progressionLevelsQuery);
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const { data: curves = [] } = useQuery(xpCurvesQuery);

  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fVisibility, setFVisibility] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("level_number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [previewType, setPreviewType] = useState<string>("");

  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const out = allLevels.filter((l) => {
      if (q) {
        const hay = `${l.title ?? ""} ${l.description ?? ""} ${l.notes ?? ""} L${l.level_number}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fType && l.progression_type_id !== fType) return false;
      if (fStatus && l.status !== fStatus) return false;
      if (fVisibility === "visible" && !l.visible) return false;
      if (fVisibility === "hidden" && !l.hidden) return false;
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
  }, [allLevels, search, fType, fStatus, fVisibility, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const save = useMutation({
    mutationFn: async (row: Draft) => {
      const errs: string[] = [];
      if (!row.progression_type_id) errs.push("Progression type required");
      if (!row.level_number || row.level_number < 1) errs.push("Level number must be >= 1");
      if ((row.xp_required ?? 0) < 0) errs.push("XP required cannot be negative");
      setErrors(errs);
      if (errs.length) throw new Error(errs.join("; "));

      const payload = { ...row };
      delete payload.id;
      if (row.id) {
        const { error } = await sb.from("progression_levels").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("progression_levels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progression_levels"] });
      setEditing(null);
      setErrors([]);
      toast.success("Level saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await sb.from("progression_levels").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progression_levels"] });
      setSelected(new Set());
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await sb.from("progression_levels").update({ status }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progression_levels"] });
      setSelected(new Set());
      toast.success("Updated");
    },
  });

  const duplicate = useMutation({
    mutationFn: async (ids: string[]) => {
      const rows = allLevels.filter((l) => ids.includes(l.id));
      const copies = rows.map((r) => {
        const c = { ...r } as Record<string, unknown>;
        delete c.id;
        delete c.created_at;
        delete c.updated_at;
        c.title = `${r.title ?? "Level"} (copy)`;
        c.level_number = r.level_number + 1000;
        c.status = "draft";
        return c;
      });
      const { error } = await sb.from("progression_levels").insert(copies);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progression_levels"] });
      toast.success("Duplicated as drafts");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: async (opts: { typeId: string; curveId: string; count: number; wipe: boolean; status: string }) => {
      const curve = curves.find((c) => c.id === opts.curveId);
      if (!curve) throw new Error("Curve required");
      if (opts.wipe) {
        const { error: delErr } = await sb.from("progression_levels").delete().eq("progression_type_id", opts.typeId);
        if (delErr) throw delErr;
      }
      const rows: Record<string, unknown>[] = [];
      let total = 0;
      const t = types.find((x) => x.id === opts.typeId);
      for (let i = 1; i <= opts.count; i++) {
        const step = computeCurveXP(curve, i);
        total += step;
        rows.push({
          progression_type_id: opts.typeId,
          level_number: i,
          xp_from_previous: step,
          xp_required: total,
          title: `${t?.name ?? "Level"} ${i}`,
          status: opts.status,
          color: t?.color ?? "#f5b544",
          icon: "⭐",
          display_order: i,
          visible: true,
          hidden: false,
          is_demo: false,
        });
      }
      const { error } = await sb.from("progression_levels").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progression_levels"] });
      setGeneratorOpen(false);
      toast.success("Levels generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportJson = () => {
    const data = JSON.stringify(filtered, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `progression_levels_${Date.now()}.json`;
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
      const { error } = await sb.from("progression_levels").insert(clean);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["progression_levels"] });
      toast.success(`Imported ${clean.length} levels`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };
  const sortIcon = (k: SortKey) =>
    sortKey !== k ? <ArrowUpDown className="inline h-3 w-3 opacity-40" /> :
    sortDir === "asc" ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />;

  const allChecked = paged.length > 0 && paged.every((r) => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) paged.forEach((r) => next.delete(r.id));
    else paged.forEach((r) => next.add(r.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  // Preview: timeline for selected progression type
  const previewLevels = useMemo(() => {
    if (!previewType) return [];
    return allLevels
      .filter((l) => l.progression_type_id === previewType)
      .sort((a, b) => a.level_number - b.level_number);
  }, [previewType, allLevels]);
  const previewTypeRow = types.find((t) => t.id === previewType);
  const previewCurve = curves.find((c) => c.id === previewTypeRow?.default_curve_id);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="panel space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search title, description, notes…"
              className={`${inputCls} pl-8`} />
          </div>
          <select value={fType} onChange={(e) => { setFType(e.target.value); setPage(0); }} className={inputCls + " w-auto"}>
            <option value="">All types</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(0); }} className={inputCls + " w-auto"}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={fVisibility} onChange={(e) => setFVisibility(e.target.value)} className={inputCls + " w-auto"}>
            <option value="">Any visibility</option>
            <option value="visible">Player visible</option>
            <option value="hidden">Hidden level</option>
          </select>
          <button onClick={() => setGeneratorOpen(true)} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
            <Wand2 className="h-3.5 w-3.5" /> Auto Generate
          </button>
          <button onClick={() => setEditing({ ...emptyDraft, progression_type_id: fType || types[0]?.id })}
            className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> New Level
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button onClick={exportJson} className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1">
            <Download className="h-3 w-3" /> Export
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1">
            <Upload className="h-3 w-3" /> Import
            <input type="file" accept="application/json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.currentTarget.value = ""; }} />
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-muted-foreground">{selected.size} selected</span>
              <button onClick={() => bulkStatus.mutate({ ids: [...selected], status: "active" })}
                className="rounded border border-border bg-surface-2 px-2 py-1">Activate</button>
              <button onClick={() => bulkStatus.mutate({ ids: [...selected], status: "draft" })}
                className="rounded border border-border bg-surface-2 px-2 py-1">Draft</button>
              <button onClick={() => bulkStatus.mutate({ ids: [...selected], status: "archived" })}
                className="rounded border border-border bg-surface-2 px-2 py-1">Archive</button>
              <button onClick={() => duplicate.mutate([...selected])}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1">
                <Copy className="h-3 w-3" /> Duplicate
              </button>
              <button onClick={() => { if (confirm(`Delete ${selected.size} levels?`)) del.mutate([...selected]); }}
                className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <AdminTable<ProgressionLevel & { id: string }>
        rows={paged}
        empty="No levels yet. Use Auto Generate to seed a progression type."
        columns={[
          {
            key: "check", label: "",
            render: (r) => (
              <button onClick={() => toggleOne(r.id)}>
                {selected.has(r.id) ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            ),
          },
          {
            key: "level", label: (<button onClick={() => toggleSort("level_number")}>Lvl {sortIcon("level_number")}</button>) as unknown as string,
            render: (r) => (
              <span className="inline-flex items-center gap-1 font-semibold">
                <span>{r.icon ?? "•"}</span>
                <span style={{ color: r.color }}>L{r.level_number}</span>
              </span>
            ),
          },
          {
            key: "type", label: "Progression Type",
            render: (r) => {
              const t = r.progression_type_id ? typeMap.get(r.progression_type_id) : undefined;
              return t ? (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: (t as ProgressionType).color }} />
                  {(t as ProgressionType).name}
                </span>
              ) : <span className="text-muted-foreground">—</span>;
            },
          },
          {
            key: "xp", label: (<button onClick={() => toggleSort("xp_from_previous")}>XP Req {sortIcon("xp_from_previous")}</button>) as unknown as string,
            render: (r) => <span>{r.xp_from_previous.toLocaleString()}</span>,
          },
          {
            key: "cum", label: (<button onClick={() => toggleSort("xp_required")}>Total XP {sortIcon("xp_required")}</button>) as unknown as string,
            render: (r) => <span className="text-muted-foreground">{r.xp_required.toLocaleString()}</span>,
          },
          {
            key: "title", label: (<button onClick={() => toggleSort("title")}>Title {sortIcon("title")}</button>) as unknown as string,
            render: (r) => <span>{r.title ?? "—"}</span>,
          },
          {
            key: "status", label: "Status",
            render: (r) => (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                r.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                r.status === "draft" ? "bg-amber-500/10 text-amber-400" :
                "bg-muted text-muted-foreground"
              }`}>{r.status}</span>
            ),
          },
          {
            key: "vis", label: "",
            render: (r) => r.hidden
              ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              : r.visible ? <Eye className="h-3.5 w-3.5 text-emerald-400" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />,
          },
          {
            key: "updated", label: (<button onClick={() => toggleSort("updated_at")}>Updated {sortIcon("updated_at")}</button>) as unknown as string,
            render: (r) => <span className="text-[10px] text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}</span>,
          },
          {
            key: "actions", label: "", className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => confirm("Delete this level?") && del.mutate([r.id])}
                  className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
      />

      {/* Pagination + select all */}
      <div className="flex items-center justify-between text-xs">
        <button onClick={toggleAll} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          {allChecked ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          Select page
        </button>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Page {page + 1} / {pageCount} · {filtered.length} rows</span>
          <button disabled={page === 0} onClick={() => setPage(page - 1)}
            className="rounded border border-border bg-surface-2 px-2 py-1 disabled:opacity-40">Prev</button>
          <button disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}
            className="rounded border border-border bg-surface-2 px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>

      {/* Preview */}
      <div className="panel space-y-3 p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Level Preview</p>
          <select value={previewType} onChange={(e) => setPreviewType(e.target.value)} className={inputCls + " ml-auto w-auto"}>
            <option value="">Select a progression type…</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {previewType && previewLevels.length === 0 && (
          <p className="text-xs text-muted-foreground">No levels for this progression type yet.</p>
        )}
        {previewLevels.length > 0 && (
          <>
            <div className="text-[10px] text-muted-foreground">
              Linked curve: <span className="text-foreground">{previewCurve?.name ?? "—"}</span> ·
              {" "}{previewLevels.length} levels · max total XP {previewLevels[previewLevels.length - 1].xp_required.toLocaleString()}
            </div>
            <div className="flex gap-1 overflow-x-auto pb-2">
              {previewLevels.map((l) => (
                <div key={l.id} className="min-w-[64px] rounded border border-border bg-surface-2 p-2 text-center">
                  <div className="text-sm font-bold" style={{ color: l.color }}>{l.icon} L{l.level_number}</div>
                  <div className="text-[9px] uppercase text-muted-foreground">{l.title}</div>
                  <div className="text-[10px] text-foreground">{l.xp_from_previous.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={() => { setEditing(null); setErrors([]); }}>
          <div className="panel-gold w-full max-w-2xl space-y-3 overflow-y-auto p-4 max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">{editing.id ? `Edit Level ${editing.level_number}` : "New Level"}</h3>
              {editing.is_demo && <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase text-amber-400">Demo</span>}
            </div>

            {errors.length > 0 && (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {errors.join(" · ")}
              </div>
            )}

            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Basic</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Progression Type">
                <select className={inputCls} value={editing.progression_type_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, progression_type_id: e.target.value })}>
                  <option value="">—</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Level Number">
                <input type="number" min={1} className={inputCls} value={editing.level_number ?? 1}
                  onChange={(e) => setEditing({ ...editing, level_number: Number(e.target.value) })} />
              </Field>
              <Field label="Title">
                <input className={inputCls} value={editing.title ?? ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </Field>
              <Field label="Icon (emoji or key)">
                <input className={inputCls} value={editing.icon ?? ""}
                  onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
              </Field>
              <Field label="Colour">
                <input type="color" className={inputCls + " h-9 p-1"} value={editing.color ?? "#f5b544"}
                  onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              </Field>
              <Field label="Status">
                <select className={inputCls} value={editing.status ?? "active"}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <textarea rows={2} className={inputCls} value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>

            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Progression</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="XP From Previous">
                <input type="number" min={0} className={inputCls} value={editing.xp_from_previous ?? 0}
                  onChange={(e) => setEditing({ ...editing, xp_from_previous: Number(e.target.value) })} />
              </Field>
              <Field label="Total XP Required">
                <input type="number" min={0} className={inputCls} value={editing.xp_required ?? 0}
                  onChange={(e) => setEditing({ ...editing, xp_required: Number(e.target.value) })} />
              </Field>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Metadata</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Display Order">
                <input type="number" className={inputCls} value={editing.display_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} />
              </Field>
              <Field label="Flags">
                <div className="flex flex-col gap-1 pt-1 text-xs">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={!!editing.visible}
                      onChange={(e) => setEditing({ ...editing, visible: e.target.checked })} />
                    Visible to players
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={!!editing.hidden}
                      onChange={(e) => setEditing({ ...editing, hidden: e.target.checked })} />
                    Hidden level (secret)
                  </label>
                </div>
              </Field>
            </div>
            <Field label="Internal Notes">
              <textarea rows={2} className={inputCls} value={editing.notes ?? ""}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setEditing(null); setErrors([]); }}
                className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={save.isPending} onClick={() => save.mutate(editing)}
                className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Generate modal */}
      {generatorOpen && (
        <AutoGenerator
          types={types}
          curves={curves}
          onCancel={() => setGeneratorOpen(false)}
          onGenerate={(opts) => generate.mutate(opts)}
          pending={generate.isPending}
        />
      )}
    </div>
  );
}

function AutoGenerator({
  types, curves, onCancel, onGenerate, pending,
}: {
  types: ProgressionType[];
  curves: XPCurve[];
  onCancel: () => void;
  onGenerate: (opts: { typeId: string; curveId: string; count: number; wipe: boolean; status: string }) => void;
  pending: boolean;
}) {
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const type = types.find((t) => t.id === typeId);
  const [curveId, setCurveId] = useState(type?.default_curve_id ?? curves[0]?.id ?? "");
  const [count, setCount] = useState(type?.max_level ?? 25);
  const [wipe, setWipe] = useState(true);
  const [status, setStatus] = useState("active");

  const curve = curves.find((c) => c.id === curveId);
  const preview = useMemo(() => {
    if (!curve) return [];
    const rows = [];
    let cum = 0;
    for (let i = 1; i <= Math.min(count, 10); i++) {
      const step = computeCurveXP(curve, i);
      cum += step;
      rows.push({ i, step, cum });
    }
    return rows;
  }, [curve, count]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={onCancel}>
      <div className="panel-gold w-full max-w-lg space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-base font-bold">Auto Generate Levels</h3>
        <p className="text-xs text-muted-foreground">Builds levels from an XP curve. Existing levels for this progression type can be wiped first.</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Progression Type">
            <select className={inputCls} value={typeId} onChange={(e) => { setTypeId(e.target.value); const t = types.find((x) => x.id === e.target.value); if (t?.default_curve_id) setCurveId(t.default_curve_id); if (t?.max_level) setCount(t.max_level); }}>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="XP Curve">
            <select className={inputCls} value={curveId} onChange={(e) => setCurveId(e.target.value)}>
              {curves.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.growth_type})</option>)}
            </select>
          </Field>
          <Field label="Levels to generate">
            <input type="number" min={1} max={500} className={inputCls} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          </Field>
          <Field label="Initial status">
            <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <label className="inline-flex items-center gap-2 text-xs">
          <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} />
          Delete existing levels for this progression type first
        </label>
        {preview.length > 0 && (
          <div className="rounded border border-border bg-surface-2 p-2 text-[11px]">
            <p className="mb-1 text-muted-foreground">Preview (first {preview.length})</p>
            <div className="grid grid-cols-3 gap-1">
              {preview.map((p) => (
                <div key={p.i}>L{p.i}: <span className="text-foreground">{p.step.toLocaleString()}</span> <span className="text-muted-foreground">({p.cum.toLocaleString()})</span></div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
          <button disabled={pending || !typeId || !curveId} onClick={() => onGenerate({ typeId, curveId, count, wipe, status })}
            className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">
            {pending ? "Generating…" : `Generate ${count} levels`}
          </button>
        </div>
      </div>
    </div>
  );
}
