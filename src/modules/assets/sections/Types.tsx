import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import { assetTypesQuery, type AssetType } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Types() {
  const qc = useQueryClient();
  const { data: types = [] } = useQuery(assetTypesQuery);
  const [editing, setEditing] = useState<Partial<AssetType> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<AssetType>) => {
      const payload = { slug: row.slug!, name: row.name!, icon: row.icon ?? null, sort_order: row.sort_order ?? 0 };
      if (row.id) {
        const { error } = await sb.from("asset_types").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("asset_types").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["asset_types"] }); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("asset_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asset_types"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ sort_order: types.length })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Type
        </button>
      </div>
      <AdminTable
        rows={types}
        columns={[
          { key: "name", label: "Name", render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: "slug", label: "Slug", render: (r) => <code className="text-[11px]">{r.slug}</code> },
          { key: "icon", label: "Icon", render: (r) => r.icon ?? "—" },
          { key: "system", label: "System", render: (r) => r.is_system ? "yes" : "" },
          {
            key: "actions", label: "", className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                {!r.is_system && <button onClick={() => confirm(`Delete ${r.name}?`) && del.mutate(r.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            ),
          },
        ]}
      />
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-sm space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Type" : "New Type"}</h3>
            <Field label="Slug"><input className={inputCls} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Icon (lucide name)"><input className={inputCls} value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></Field>
            <Field label="Sort order"><input type="number" className={inputCls} value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} /></Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={!editing.slug || !editing.name || save.isPending} onClick={() => save.mutate(editing)} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">{save.isPending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
