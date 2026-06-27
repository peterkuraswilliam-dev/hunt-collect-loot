import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export type CrudField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select";
  options?: Array<{ value: string; label: string }>;
};

export function SimpleCrud<T extends { id: string }>({
  table,
  queryKey,
  title,
  fields,
  defaults,
}: {
  table: string;
  queryKey: string;
  title: string;
  fields: CrudField[];
  defaults?: Record<string, unknown>;
}) {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await sb.from(table).select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      const { id, ...rest } = row as { id?: string } & Record<string, unknown>;
      if (id) {
        const { error } = await sb.from(table).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from(table).insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); setEditing(null); toast.success("Saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</p>
        <button onClick={() => setEditing(defaults ?? {})} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>
      <AdminTable
        rows={rows}
        columns={[
          { key: "name", label: "Name", render: (r) => <span className="font-semibold">{(r as { name?: string }).name ?? (r as { slug?: string }).slug ?? r.id.slice(0, 6)}</span> },
          { key: "slug", label: "Slug", render: (r) => <span className="text-[11px] text-muted-foreground">{(r as { slug?: string }).slug}</span> },
          {
            key: "actions", label: "", className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => confirm("Delete?") && del.mutate(r.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
      />
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-md space-y-3 overflow-y-auto p-4 max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{(editing as { id?: string }).id ? "Edit" : "New"}</h3>
            {fields.map((f) => {
              const v = (editing as Record<string, unknown>)[f.key] ?? "";
              const onChange = (val: unknown) => setEditing({ ...editing, [f.key]: val } as Partial<T>);
              if (f.type === "textarea") return <Field key={f.key} label={f.label}><textarea className={inputCls} rows={3} value={String(v)} onChange={(e) => onChange(e.target.value)} /></Field>;
              if (f.type === "number") return <Field key={f.key} label={f.label}><input type="number" className={inputCls} value={String(v ?? 0)} onChange={(e) => onChange(Number(e.target.value))} /></Field>;
              if (f.type === "select") return <Field key={f.key} label={f.label}><select className={inputCls} value={String(v)} onChange={(e) => onChange(e.target.value)}>{(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>;
              return <Field key={f.key} label={f.label}><input className={inputCls} value={String(v ?? "")} onChange={(e) => onChange(e.target.value)} /></Field>;
            })}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={save.isPending} onClick={() => save.mutate(editing)} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">{save.isPending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
