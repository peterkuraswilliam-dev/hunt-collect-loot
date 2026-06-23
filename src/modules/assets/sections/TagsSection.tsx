import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import { tagsQuery, type Tag } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function TagsSection() {
  const qc = useQueryClient();
  const { data: tags = [] } = useQuery(tagsQuery);
  const [editing, setEditing] = useState<Partial<Tag> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<Tag>) => {
      const payload = {
        slug: row.slug!,
        name: row.name!,
        color: row.color ?? "#6366f1",
        icon: row.icon ?? null,
        description: row.description ?? null,
        parent_id: row.parent_id ?? null,
      };
      if (row.id) {
        const { error } = await sb.from("tags").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("tags").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tags"] }); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ color: "#6366f1" })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Tag
        </button>
      </div>
      <AdminTable
        rows={tags}
        columns={[
          { key: "color", label: "", render: (r) => <span className="inline-block h-4 w-4 rounded" style={{ background: r.color ?? "#6366f1" }} /> },
          { key: "name", label: "Name", render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: "slug", label: "Slug", render: (r) => <code className="text-[11px]">{r.slug}</code> },
          { key: "parent", label: "Parent", render: (r) => tags.find((t) => t.id === r.parent_id)?.name ?? "—" },
          { key: "icon", label: "Icon", render: (r) => r.icon ?? "—" },
          {
            key: "actions", label: "", className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => confirm(`Delete ${r.name}?`) && del.mutate(r.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
        empty="No tags yet. Create tags like Scotland, Peterhead, Landmark, Fishing."
      />
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-sm space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Tag" : "New Tag"}</h3>
            <Field label="Slug"><input className={inputCls} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Color"><input type="color" className="h-9 w-full rounded-md border border-border bg-surface-2" value={editing.color ?? "#6366f1"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} /></Field>
              <Field label="Icon (lucide name)"><input className={inputCls} value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></Field>
            </div>
            <Field label="Parent Tag">
              <select className={inputCls} value={editing.parent_id ?? ""} onChange={(e) => setEditing({ ...editing, parent_id: e.target.value || null })}>
                <option value="">— none —</option>
                {tags.filter((t) => t.id !== editing.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
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
