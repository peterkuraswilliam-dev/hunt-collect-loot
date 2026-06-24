import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { collectionsAllQuery, collectionAssetsQuery } from "../queries";
import { tagsQuery } from "@/modules/assets/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Rules() {
  const qc = useQueryClient();
  const { data: collections = [] } = useQuery(collectionsAllQuery);
  const { data: tags = [] } = useQuery(tagsQuery);
  const { data: links = [] } = useQuery(collectionAssetsQuery);
  const [selectedId, setSelectedId] = useState<string>("");

  const c = collections.find((x) => x.id === selectedId);
  const owned = links.filter((l) => l.collection_id === selectedId).length;

  function toggle(arr: string[], id: string) {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
  }

  async function update(patch: Record<string, unknown>) {
    if (!c) return;
    const { error } = await sb.from("collections").update(patch).eq("id", c.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["collections_all"] });
    qc.invalidateQueries({ queryKey: ["collection_assets_join"] });
  }

  async function recompute() {
    if (!c) return;
    const { error } = await sb.rpc("recompute_collection", { p_collection_id: c.id });
    if (error) return toast.error(error.message);
    toast.success("Recomputed");
    qc.invalidateQueries({ queryKey: ["collection_assets_join"] });
  }

  return (
    <div className="space-y-3">
      <select className="input w-full" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        <option value="">— Select collection —</option>
        {collections.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>

      {c && (
        <div className="panel p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display font-bold">{c.name}</p>
              <p className="text-[10px] text-muted-foreground">{owned} assets matched</p>
            </div>
            <button className="btn-secondary" onClick={recompute}><RefreshCw className="h-3.5 w-3.5" /> Recompute</button>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Match mode</p>
            <div className="flex gap-2">
              {(["all", "any"] as const).map((m) => (
                <button key={m} onClick={() => update({ match_mode: m })}
                  className={`btn-secondary flex-1 ${c.match_mode === m ? "border-primary text-primary" : ""}`}>
                  {m === "all" ? "Match ALL include tags" : "Match ANY include tag"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Include tags</p>
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => {
                const on = (c.include_tags ?? []).includes(t.id);
                return (
                  <button key={t.id} onClick={() => update({ include_tags: toggle(c.include_tags ?? [], t.id) })}
                    className={`rounded-md border px-2 py-1 text-[11px] ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground"}`}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Exclude tags</p>
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => {
                const on = (c.exclude_tags ?? []).includes(t.id);
                return (
                  <button key={t.id} onClick={() => update({ exclude_tags: toggle(c.exclude_tags ?? [], t.id) })}
                    className={`rounded-md border px-2 py-1 text-[11px] ${on ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-surface-2 text-muted-foreground"}`}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
