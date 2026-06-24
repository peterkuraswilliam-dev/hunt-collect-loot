import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { collectionsAllQuery, collectionSetsQuery, type CollectionRow } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Management() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery(collectionsAllQuery);
  const { data: sets = [] } = useQuery(collectionSetsQuery);
  const [editing, setEditing] = useState<Partial<CollectionRow> | null>(null);

  async function save() {
    if (!editing?.name || !editing?.slug) { toast.error("Name and slug required"); return; }
    const payload = {
      slug: editing.slug,
      name: editing.name,
      description: editing.description ?? null,
      image_url: editing.image_url ?? null,
      type: editing.type ?? "standard",
      status: editing.status ?? "active",
      set_id: editing.set_id ?? null,
    };
    const { error } = editing.id
      ? await sb.from("collections").update(payload).eq("id", editing.id)
      : await sb.from("collections").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["collections_all"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete collection?")) return;
    const { error } = await sb.from("collections").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["collections_all"] });
  }

  async function recomputeAll() {
    const { error } = await sb.rpc("recompute_all_collections");
    if (error) return toast.error(error.message);
    toast.success("Recomputed");
    qc.invalidateQueries({ queryKey: ["collection_assets_join"] });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={() => setEditing({ status: "active", type: "standard", match_mode: "all" })}>
          <Plus className="h-4 w-4" /> New collection
        </button>
        <button className="btn-secondary" onClick={recomputeAll}><RefreshCw className="h-4 w-4" /></button>
      </div>

      {editing && (
        <div className="panel p-3 space-y-2">
          <input className="input w-full" placeholder="Name" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <input className="input w-full" placeholder="Slug" value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
          <textarea className="input w-full" placeholder="Description" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          <input className="input w-full" placeholder="Image URL" value={editing.image_url ?? ""} onChange={(e) => setEditing({ ...editing, image_url: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="Type" value={editing.type ?? ""} onChange={(e) => setEditing({ ...editing, type: e.target.value })} />
            <select className="input" value={editing.status ?? "active"} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <select className="input w-full" value={editing.set_id ?? ""} onChange={(e) => setEditing({ ...editing, set_id: e.target.value || null })}>
            <option value="">— No set —</option>
            {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <p className="text-[10px] text-muted-foreground">Assets are auto-populated by Rules. Configure include/exclude tags in the Rules tab.</p>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={save}>Save</button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel divide-y divide-border">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center gap-2 p-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{c.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{c.slug} · {c.status} · {c.type ?? "standard"}</p>
            </div>
            <button className="btn-secondary" onClick={() => setEditing(c)}>Edit</button>
            <button className="btn-secondary" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {rows.length === 0 && <p className="p-3 text-xs text-muted-foreground">No collections.</p>}
      </div>
    </div>
  );
}
