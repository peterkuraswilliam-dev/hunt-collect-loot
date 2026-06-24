import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { collectionSetsQuery, type CollectionSet, collectionsAllQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Sets() {
  const qc = useQueryClient();
  const { data: sets = [] } = useQuery(collectionSetsQuery);
  const { data: collections = [] } = useQuery(collectionsAllQuery);
  const [editing, setEditing] = useState<Partial<CollectionSet> | null>(null);

  async function save() {
    if (!editing?.name || !editing?.slug) return toast.error("Name and slug required");
    const payload = {
      slug: editing.slug, name: editing.name,
      description: editing.description ?? null,
      parent_id: editing.parent_id ?? null,
      sort_order: editing.sort_order ?? 0,
    };
    const { error } = editing.id
      ? await sb.from("collection_sets").update(payload).eq("id", editing.id)
      : await sb.from("collection_sets").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["collection_sets"] });
  }

  async function remove(id: string) {
    if (!confirm("Delete set?")) return;
    const { error } = await sb.from("collection_sets").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["collection_sets"] });
  }

  // build tree
  const byParent = new Map<string | null, CollectionSet[]>();
  for (const s of sets) {
    const k = s.parent_id ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(s);
  }
  const renderNode = (node: CollectionSet, depth: number): JSX.Element => {
    const children = byParent.get(node.id) ?? [];
    const owned = collections.filter((c) => c.set_id === node.id);
    return (
      <div key={node.id} style={{ paddingLeft: depth * 12 }} className="border-l border-border/40 pl-2">
        <div className="flex items-center gap-2 py-1 text-sm">
          <div className="flex-1">
            <p className="font-semibold">{node.name}</p>
            <p className="text-[10px] text-muted-foreground">{owned.length} collections</p>
          </div>
          <button className="btn-secondary" onClick={() => setEditing(node)}>Edit</button>
          <button className="btn-secondary" onClick={() => remove(node.id)}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <button className="btn-primary w-full" onClick={() => setEditing({ sort_order: 0 })}>
        <Plus className="h-4 w-4" /> New set
      </button>

      {editing && (
        <div className="panel p-3 space-y-2">
          <input className="input w-full" placeholder="Name" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <input className="input w-full" placeholder="Slug" value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} />
          <textarea className="input w-full" placeholder="Description" value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          <select className="input w-full" value={editing.parent_id ?? ""} onChange={(e) => setEditing({ ...editing, parent_id: e.target.value || null })}>
            <option value="">— No parent (top level) —</option>
            {sets.filter((s) => s.id !== editing.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={save}>Save</button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="panel p-2">
        {(byParent.get(null) ?? []).map((n) => renderNode(n, 0))}
        {sets.length === 0 && <p className="p-3 text-xs text-muted-foreground">No sets.</p>}
      </div>
    </div>
  );
}
