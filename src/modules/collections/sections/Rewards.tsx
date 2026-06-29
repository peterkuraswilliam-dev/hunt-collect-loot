import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { collectionsAllQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const THRESHOLDS = [25, 50, 75, 100];
const KINDS = ["credits", "energy", "pack", "asset", "spins", "unlock"] as const;

type Reward = { threshold: number; type: string; value?: number; pack_slug?: string; asset_rarity?: string };

export function Rewards() {
  const qc = useQueryClient();
  const { data: collections = [] } = useQuery(collectionsAllQuery);
  const [selectedId, setSelectedId] = useState<string>("");
  const c = collections.find((x) => x.id === selectedId);
  const rewards: Reward[] = (c?.rewards ?? []) as Reward[];

  async function save(next: Reward[]) {
    if (!c) return;
    const { error } = await sb.from("collections").update({ rewards: next }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["collections_all"] });
  }

  function add() { save([...rewards, { threshold: 25, type: "credits", value: 100 }]); }
  function update(i: number, patch: Partial<Reward>) {
    save(rewards.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }
  function remove(i: number) { save(rewards.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-3">
      <select className="input w-full" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        <option value="">— Select collection —</option>
        {collections.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>

      {c && (
        <div className="panel p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold">{c.name} · Milestone rewards</p>
            <button className="btn-secondary" onClick={add}><Plus className="h-3.5 w-3.5" /></button>
          </div>
          {rewards.map((r, i) => (
            <div key={i} className="rounded-md border border-border p-2 space-y-1">
              <div className="grid grid-cols-3 gap-1">
                <select className="input" value={r.threshold} onChange={(e) => update(i, { threshold: Number(e.target.value) })}>
                  {THRESHOLDS.map((t) => <option key={t} value={t}>{t}%</option>)}
                </select>
                <select className="input" value={r.type} onChange={(e) => update(i, { type: e.target.value })}>
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <input className="input" type="number" placeholder="value" value={r.value ?? 0} onChange={(e) => update(i, { value: Number(e.target.value) })} />
              </div>
              {r.type === "pack" && <input className="input w-full" placeholder="pack slug" value={r.pack_slug ?? ""} onChange={(e) => update(i, { pack_slug: e.target.value })} />}
              {r.type === "asset" && <input className="input w-full" placeholder="asset rarity (common/rare/...)" value={r.asset_rarity ?? ""} onChange={(e) => update(i, { asset_rarity: e.target.value })} />}
              <button className="btn-secondary w-full" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {rewards.length === 0 && <p className="text-xs text-muted-foreground">No milestone rewards.</p>}
        </div>
      )}
    </div>
  );
}
