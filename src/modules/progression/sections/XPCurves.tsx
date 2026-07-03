import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Copy, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { xpCurvesQuery, type XPCurve } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const GROWTH_TYPES = [
  { value: "linear", label: "Linear" },
  { value: "exponential", label: "Exponential" },
  { value: "soft_exponential", label: "Soft Exponential" },
  { value: "logarithmic", label: "Logarithmic" },
  { value: "custom", label: "Custom (reserved)" },
] as const;

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
] as const;

const emptyCurve: Partial<XPCurve> = {
  name: "",
  slug: "",
  description: "",
  notes: "",
  growth_type: "linear",
  base_xp: 100,
  starting_xp: 0,
  growth_multiplier: 1.15,
  growth_factor: 1,
  max_level: 50,
  decimal_precision: 0,
  smoothing: false,
  status: "draft",
  version: 1,
};

function computeLevelXP(c: Partial<XPCurve>, level: number): number {
  const base = Number(c.base_xp ?? 0);
  const start = Number(c.starting_xp ?? 0);
  const mult = Number(c.growth_multiplier ?? 1);
  const factor = Number(c.growth_factor ?? 1);
  const i = Math.max(1, level);
  let v = base;
  switch (c.growth_type) {
    case "linear":
      v = start + base * i * factor;
      break;
    case "exponential":
      v = start + base * Math.pow(mult, i - 1) * factor;
      break;
    case "soft_exponential":
      v = start + base * i * Math.pow(mult, Math.sqrt(i - 1)) * factor;
      break;
    case "logarithmic":
      v = start + base * factor * Math.log2(i + 1) * mult;
      break;
    case "custom":
    default:
      v = start + base * i * factor;
  }
  const prec = Math.max(0, Math.min(6, Number(c.decimal_precision ?? 0)));
  return Number(v.toFixed(prec));
}

function buildSeries(c: Partial<XPCurve>, count: number) {
  const out: { level: number; xp: number; total: number; growth: number }[] = [];
  let total = 0;
  let prev = 0;
  const smoothing = !!c.smoothing;
  let smoothed = 0;
  for (let i = 1; i <= count; i++) {
    let xp = computeLevelXP(c, i);
    if (smoothing && i > 1) {
      smoothed = smoothed * 0.6 + xp * 0.4;
      xp = Number(smoothed.toFixed(Math.max(0, Number(c.decimal_precision ?? 0))));
    } else if (smoothing) {
      smoothed = xp;
    }
    total += xp;
    const growth = prev > 0 ? ((xp - prev) / prev) * 100 : 0;
    out.push({ level: i, xp, total, growth });
    prev = xp;
  }
  return out;
}

function validate(c: Partial<XPCurve>, existing: XPCurve[]): string | null {
  if (!c.name?.trim()) return "Name is required.";
  if (!c.slug?.trim()) return "Slug is required.";
  if (Number(c.max_level ?? 0) <= 0) return "Maximum Level must be greater than zero.";
  if (Number(c.base_xp ?? 0) < 0) return "Base XP cannot be negative.";
  if (Number(c.starting_xp ?? 0) < 0) return "Starting XP cannot be negative.";
  if (Number(c.growth_multiplier ?? 0) <= 0) return "Growth Multiplier must be greater than zero.";
  if (Number(c.growth_factor ?? 0) <= 0) return "Growth Factor must be greater than zero.";
  if (Number(c.decimal_precision ?? 0) < 0 || Number(c.decimal_precision ?? 0) > 6) return "Decimal Precision must be 0-6.";
  if (c.status === "active") {
    const clash = existing.find(
      (x) => x.id !== c.id && x.status === "active" && x.name.trim().toLowerCase() === c.name!.trim().toLowerCase(),
    );
    if (clash) return "Another active curve already uses this name.";
  }
  return null;
}

function CurveGraph({ points, height = 140 }: { points: { level: number; xp: number }[]; height?: number }) {
  const w = 320;
  const h = height;
  if (points.length < 2) return <div className="h-[140px]" />;
  const max = Math.max(...points.map((p) => p.xp), 1);
  const stepX = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(2)} ${(h - (p.xp / max) * h).toFixed(2)}`)
    .join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[140px] w-full text-primary">
      <defs>
        <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#xpFill)" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function CurveEditor({
  value,
  existing,
  onCancel,
  onSave,
  saving,
}: {
  value: Partial<XPCurve>;
  existing: XPCurve[];
  onCancel: () => void;
  onSave: (v: Partial<XPCurve>) => void;
  saving: boolean;
}) {
  const [c, setC] = useState<Partial<XPCurve>>(value);
  const [previewCount, setPreviewCount] = useState(20);
  const set = (k: keyof XPCurve, v: unknown) => setC((prev) => ({ ...prev, [k]: v }));

  const points = useMemo(() => {
    const n = Math.min(Number(c.max_level ?? 50), Math.max(5, previewCount));
    return buildSeries(c, n);
  }, [c, previewCount]);

  const err = validate(c, existing);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={onCancel}>
      <div className="panel-gold w-full max-w-3xl overflow-y-auto p-4 max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">{c.id ? "Edit XP Curve" : "New XP Curve"}</h3>
          {c.version ? <span className="text-[10px] text-muted-foreground">v{c.version}</span> : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Name">
            <input className={inputCls} value={String(c.name ?? "")} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Slug">
            <input className={inputCls} value={String(c.slug ?? "")} onChange={(e) => set("slug", e.target.value)} />
          </Field>
          <Field label="Status">
            <select className={inputCls} value={String(c.status ?? "draft")} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Version">
            <input type="number" className={inputCls} value={Number(c.version ?? 1)} onChange={(e) => set("version", Number(e.target.value))} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <textarea className={inputCls} rows={2} value={String(c.description ?? "")} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Notes">
              <textarea className={inputCls} rows={2} value={String(c.notes ?? "")} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </div>

        <p className="mt-4 mb-2 text-[10px] uppercase tracking-widest text-primary">Curve Configuration</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Growth Type">
            <select className={inputCls} value={String(c.growth_type ?? "linear")} onChange={(e) => set("growth_type", e.target.value)}>
              {GROWTH_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Starting XP">
            <input type="number" className={inputCls} value={Number(c.starting_xp ?? 0)} onChange={(e) => set("starting_xp", Number(e.target.value))} />
          </Field>
          <Field label="Base XP">
            <input type="number" className={inputCls} value={Number(c.base_xp ?? 0)} onChange={(e) => set("base_xp", Number(e.target.value))} />
          </Field>
          <Field label="Growth Multiplier">
            <input type="number" step="0.01" className={inputCls} value={Number(c.growth_multiplier ?? 1)} onChange={(e) => set("growth_multiplier", Number(e.target.value))} />
          </Field>
          <Field label="Growth Factor">
            <input type="number" step="0.01" className={inputCls} value={Number(c.growth_factor ?? 1)} onChange={(e) => set("growth_factor", Number(e.target.value))} />
          </Field>
          <Field label="Maximum Level">
            <input type="number" className={inputCls} value={Number(c.max_level ?? 50)} onChange={(e) => set("max_level", Number(e.target.value))} />
          </Field>
          <Field label="Decimal Precision">
            <input type="number" min={0} max={6} className={inputCls} value={Number(c.decimal_precision ?? 0)} onChange={(e) => set("decimal_precision", Number(e.target.value))} />
          </Field>
          <label className="flex items-end gap-2 text-xs">
            <input type="checkbox" checked={!!c.smoothing} onChange={(e) => set("smoothing", e.target.checked)} />
            Enable Curve Smoothing
          </label>
        </div>

        <p className="mt-4 mb-2 text-[10px] uppercase tracking-widest text-primary">Live Preview</p>
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <CurveGraph points={points} />
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Preview levels:</span>
            <input
              type="range"
              min={5}
              max={Math.min(200, Number(c.max_level ?? 50))}
              value={previewCount}
              onChange={(e) => setPreviewCount(Number(e.target.value))}
              className="flex-1"
            />
            <span className="tabular-nums">{previewCount}</span>
          </div>
          <div className="mt-3 max-h-48 overflow-auto rounded border border-border/60">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-surface-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">Lv</th>
                  <th className="px-2 py-1">XP Required</th>
                  <th className="px-2 py-1">Cumulative</th>
                  <th className="px-2 py-1">Growth</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.level} className="border-t border-border/40">
                    <td className="px-2 py-1 tabular-nums">{p.level}</td>
                    <td className="px-2 py-1 tabular-nums">{p.xp.toLocaleString()}</td>
                    <td className="px-2 py-1 tabular-nums">{p.total.toLocaleString()}</td>
                    <td className="px-2 py-1 tabular-nums">{p.growth.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {err && <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
          <button
            disabled={saving || !!err}
            onClick={() => onSave(c)}
            className="btn-gold flex-1 py-2 text-xs disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Curve"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function XPCurves() {
  const qc = useQueryClient();
  const { data: curves = [] } = useQuery(xpCurvesQuery);
  const [editing, setEditing] = useState<Partial<XPCurve> | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [growthFilter, setGrowthFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "updated" | "max_level">("updated");

  const save = useMutation({
    mutationFn: async (row: Partial<XPCurve>) => {
      const err = validate(row, curves);
      if (err) throw new Error(err);
      const { id, created_at, updated_at, ...rest } = row as XPCurve;
      void created_at; void updated_at;
      if (id) {
        const { error } = await sb.from("xp_curves").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("xp_curves").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["xp_curves"] }); setEditing(null); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("xp_curves").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["xp_curves"] }); toast.success("Deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<XPCurve> }) => {
      const { error } = await sb.from("xp_curves").update(changes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["xp_curves"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = async (c: XPCurve) => {
    const copy = { ...c } as Partial<XPCurve>;
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    copy.name = `${c.name} (Copy)`;
    copy.slug = `${c.slug}-copy-${Math.random().toString(36).slice(2, 6)}`;
    copy.status = "draft";
    copy.version = (c.version ?? 1) + 1;
    save.mutate(copy);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = curves.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (growthFilter !== "all" && c.growth_type !== growthFilter) return false;
      if (q && !`${c.name} ${c.slug} ${c.description ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "max_level") return b.max_level - a.max_level;
      return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
    });
    return list;
  }, [curves, search, statusFilter, growthFilter, sortBy]);

  return (
    <div className="space-y-3">
      <div className="panel flex flex-wrap items-center gap-2 p-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inputCls} pl-7`} placeholder="Search curves…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={inputCls + " w-auto"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={growthFilter} onChange={(e) => setGrowthFilter(e.target.value)}>
          <option value="all">All growth</option>
          {GROWTH_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className={inputCls + " w-auto"} value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "updated" | "max_level")}>
          <option value="updated">Recently updated</option>
          <option value="name">Name (A–Z)</option>
          <option value="max_level">Max level</option>
        </select>
        <button onClick={() => setEditing({ ...emptyCurve })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Curve
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="panel p-6 text-center text-xs text-muted-foreground">No curves match your filters.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((c) => {
            const preview = buildSeries(c, Math.min(30, c.max_level));
            const statusColor =
              c.status === "active" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
              : c.status === "draft" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
              : "bg-muted text-muted-foreground border-border";
            return (
              <div key={c.id} className="panel space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-sm font-bold">{c.name}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-widest ${statusColor}`}>{c.status}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{c.slug} · v{c.version} · {c.growth_type} · max {c.max_level}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button title="Edit" onClick={() => setEditing(c)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                    <button title="Duplicate" onClick={() => duplicate(c)} className="rounded p-1 hover:bg-surface-2"><Copy className="h-3.5 w-3.5" /></button>
                    <button
                      title={c.status === "archived" ? "Restore to draft" : "Archive"}
                      onClick={() => patch.mutate({ id: c.id, changes: { status: c.status === "archived" ? "draft" : "archived" } })}
                      className="rounded p-1 hover:bg-surface-2"
                    ><Archive className="h-3.5 w-3.5" /></button>
                    <button title="Delete" onClick={() => confirm(`Delete "${c.name}"?`) && del.mutate(c.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <CurveGraph points={preview} height={90} />
                <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                  <div><span className="block text-primary">Base XP</span>{c.base_xp}</div>
                  <div><span className="block text-primary">Multiplier</span>{c.growth_multiplier}</div>
                  <div><span className="block text-primary">Factor</span>{c.growth_factor}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <CurveEditor
          value={editing}
          existing={curves}
          saving={save.isPending}
          onCancel={() => setEditing(null)}
          onSave={(v) => save.mutate(v)}
        />
      )}
    </div>
  );
}
