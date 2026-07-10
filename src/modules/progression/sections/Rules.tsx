import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Trash2, Archive, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import { progressionTypesQuery, xpSourcesQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Rule = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rule_type: string;
  value: number;
  priority: number;
  enabled: boolean;
  status: string;
  progression_type_id: string | null;
  xp_source_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  notes: string | null;
  is_demo: boolean;
  updated_at: string;
};

const RULE_TYPES = [
  { value: "global_multiplier", label: "Global Multiplier" },
  { value: "type_multiplier", label: "Progression Type Multiplier" },
  { value: "source_multiplier", label: "XP Source Multiplier" },
  { value: "level_requirement", label: "Level Requirement" },
  { value: "daily_xp_limit", label: "Daily XP Limit" },
  { value: "weekly_xp_limit", label: "Weekly XP Limit" },
  { value: "min_level", label: "Minimum Level" },
  { value: "max_level", label: "Maximum Level" },
];

export function Rules() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["progression_rules"],
    queryFn: async (): Promise<Rule[]> => {
      const { data, error } = await sb
        .from("progression_rules")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const { data: sources = [] } = useQuery(xpSourcesQuery);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [enabledFilter, setEnabledFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Partial<Rule> | null>(null);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search && !`${r.name} ${r.slug}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter !== "all" && r.rule_type !== typeFilter) return false;
      if (enabledFilter !== "all" && r.enabled !== (enabledFilter === "on")) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, typeFilter, enabledFilter, statusFilter]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["progression_rules"] });

  const save = useMutation({
    mutationFn: async (r: Partial<Rule>) => {
      const payload: Record<string, unknown> = { ...r };
      delete payload.updated_at;
      if (!payload.slug && payload.name) {
        payload.slug = String(payload.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }
      if (payload.starts_at === "") payload.starts_at = null;
      if (payload.ends_at === "") payload.ends_at = null;
      if (r.id) {
        const { error } = await sb.from("progression_rules").update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("progression_rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); setEditing(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await sb.from("progression_rules").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); setSelected(new Set()); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkUpdate = useMutation({
    mutationFn: async (patch: Partial<Rule>) => {
      const { error } = await sb.from("progression_rules").update(patch).in("id", Array.from(selected));
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); setSelected(new Set()); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (r: Rule) => {
      const { id: _id, updated_at: _u, ...rest } = r;
      const copy = { ...rest, slug: `${r.slug}-copy-${Date.now()}`, name: `${r.name} (copy)`, is_demo: false };
      const { error } = await sb.from("progression_rules").insert(copy);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Duplicated"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  return (
    <div className="space-y-3">
      <div className="panel p-3 flex flex-wrap items-center gap-2 text-xs">
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls + " max-w-xs"} />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inputCls + " max-w-xs"}>
          <option value="all">All types</option>
          {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={enabledFilter} onChange={(e) => setEnabledFilter(e.target.value)} className={inputCls + " max-w-[10rem]"}>
          <option value="all">All states</option>
          <option value="on">Enabled</option>
          <option value="off">Disabled</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls + " max-w-[10rem]"}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setEditing({ rule_type: "global_multiplier", value: 1, priority: 100, enabled: true, status: "active" })}
            className="btn-gold flex items-center gap-1 px-3 py-1.5"
          >
            <Plus className="h-3 w-3" /> New rule
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="panel p-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold">{selected.size} selected</span>
          <button onClick={() => bulkUpdate.mutate({ enabled: true })} className="btn-gold px-2 py-1"><Power className="h-3 w-3 inline" /> Enable</button>
          <button onClick={() => bulkUpdate.mutate({ enabled: false })} className="btn-gold px-2 py-1">Disable</button>
          <button onClick={() => bulkUpdate.mutate({ status: "archived" })} className="btn-gold px-2 py-1"><Archive className="h-3 w-3 inline" /> Archive</button>
          <button onClick={() => remove.mutate(Array.from(selected))} className="btn-gold px-2 py-1"><Trash2 className="h-3 w-3 inline" /> Delete</button>
        </div>
      )}

      <AdminTable
        rows={filtered}
        empty="No rules yet."
        columns={[
          { key: "sel", label: "", render: (r) => <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /> },
          { key: "name", label: "Name", render: (r) => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-muted-foreground">{r.slug}</div></div> },
          { key: "type", label: "Type", render: (r) => <span className="text-[10px] uppercase tracking-wider">{RULE_TYPES.find((t) => t.value === r.rule_type)?.label ?? r.rule_type}</span> },
          { key: "value", label: "Value", render: (r) => <span className="font-mono">{r.value}</span> },
          { key: "priority", label: "Prio", render: (r) => r.priority },
          { key: "enabled", label: "On", render: (r) => r.enabled ? "✅" : "⛔" },
          { key: "status", label: "Status", render: (r) => r.status },
          {
            key: "actions",
            label: "",
            render: (r) => (
              <div className="flex gap-1">
                <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3 w-3" /></button>
                <button onClick={() => duplicate.mutate(r)} className="rounded p-1 hover:bg-surface-2"><Copy className="h-3 w-3" /></button>
                <button onClick={() => remove.mutate([r.id])} className="rounded p-1 hover:bg-surface-2"><Trash2 className="h-3 w-3" /></button>
              </div>
            ),
          },
        ]}
      />

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div className="panel w-full max-w-lg p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-lg">{editing.id ? "Edit rule" : "New rule"}</div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name"><input className={inputCls} value={String(editing.name ?? "")} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Slug"><input className={inputCls} value={String(editing.slug ?? "")} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
              <Field label="Rule Type">
                <select className={inputCls} value={String(editing.rule_type ?? "global_multiplier")} onChange={(e) => setEditing({ ...editing, rule_type: e.target.value })}>
                  {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Value"><input type="number" step="0.01" className={inputCls} value={Number(editing.value ?? 0)} onChange={(e) => setEditing({ ...editing, value: parseFloat(e.target.value) })} /></Field>
              <Field label="Priority"><input type="number" className={inputCls} value={Number(editing.priority ?? 100)} onChange={(e) => setEditing({ ...editing, priority: parseInt(e.target.value) })} /></Field>
              <Field label="Status">
                <select className={inputCls} value={String(editing.status ?? "active")} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
                </select>
              </Field>
              <Field label="Progression Type">
                <select className={inputCls} value={String(editing.progression_type_id ?? "")} onChange={(e) => setEditing({ ...editing, progression_type_id: e.target.value || null })}>
                  <option value="">— none —</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="XP Source">
                <select className={inputCls} value={String(editing.xp_source_id ?? "")} onChange={(e) => setEditing({ ...editing, xp_source_id: e.target.value || null })}>
                  <option value="">— none —</option>
                  {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="Starts at (ISO)"><input className={inputCls} value={String(editing.starts_at ?? "")} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} /></Field>
              <Field label="Ends at (ISO)"><input className={inputCls} value={String(editing.ends_at ?? "")} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })} /></Field>
              <label className="col-span-2 flex items-center gap-2 text-xs">
                <input type="checkbox" checked={Boolean(editing.enabled)} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />
                Enabled
              </label>
              <Field label="Description"><textarea className={inputCls} rows={2} value={String(editing.description ?? "")} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
              <Field label="Notes"><textarea className={inputCls} rows={2} value={String(editing.notes ?? "")} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="rounded border border-border px-3 py-1.5 text-xs">Cancel</button>
              <button onClick={() => save.mutate(editing)} className="btn-gold px-3 py-1.5 text-xs">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
