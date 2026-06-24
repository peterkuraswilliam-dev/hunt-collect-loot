import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { collectionsAllQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const THRESHOLDS = [25, 50, 75, 100];
const TYPES = ["energy_max", "energy_regen", "production_multiplier", "credits_multiplier", "xp_multiplier", "realm_unlock"];

type Bonus = { threshold: number; type: string; value?: number; spin_tokens?: number };

export function Bonuses() {
  const qc = useQueryClient();
  const { data: collections = [] } = useQuery(collectionsAllQuery);
  const [selectedId, setSelectedId] = useState<string>("");
  const c = collections.find((x) => x.id === selectedId);
  const bonuses: Bonus[] = (c?.bonuses ?? []) as Bonus[];

  async function save(next: Bonus[]) {
    if (!c) return;
    const { error } = await sb.from("collections").update({ bonuses: next }).eq("id", c.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["collections_all"] });
  }

  function add() { save([...bonuses, { threshold: 25, type: "energy_max", value: 5 }]); }
  function update(i: number, patch: Partial<Bonus>) { save(bonuses.map((b, idx) => idx === i ? { ...b, ...patch } : b)); }
  function remove(i: number) { save(bonuses.filter((_, idx) => idx !== i)); }

  return (
    <div className="space-y-3">
      <select className="input w-full" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        <option value="">— Select collection —</option>
        {collections.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>

      {c && (
        <div className="panel p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-display font-bold">{c.name} · Completion bonuses</p>
            <button className="btn-secondary" onClick={add}><Plus className="h-3.5 w-3.5" /></button>
          </div>
          {bonuses.map((b, i) => (
            <div key={i} className="rounded-md border border-border p-2 space-y-1">
              <div className="grid grid-cols-4 gap-1">
                <select className="input" value={b.threshold} onChange={(e) => update(i, { threshold: Number(e.target.value) })}>
                  {THRESHOLDS.map((t) => <option key={t} value={t}>{t}%</option>)}
                </select>
                <select className="input col-span-2" value={b.type} onChange={(e) => update(i, { type: e.target.value })}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="input" type="number" placeholder="value" value={b.value ?? 0} onChange={(e) => update(i, { value: Number(e.target.value) })} />
              </div>
              <input className="input w-full" type="number" placeholder="spin tokens" value={b.spin_tokens ?? 0} onChange={(e) => update(i, { spin_tokens: Number(e.target.value) })} />
              <button className="btn-secondary w-full" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {bonuses.length === 0 && <p className="text-xs text-muted-foreground">No bonuses configured.</p>}
        </div>
      )}
    </div>
  );
}
