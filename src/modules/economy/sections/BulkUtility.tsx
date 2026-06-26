import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wand2, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { assetsQuery, collectionsQuery } from "@/lib/queries";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { tagsQuery, assetTagsQuery, assetTypesQuery, assetRaritiesQuery } from "@/modules/assets/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Op = "set" | "add" | "multiply";

export function BulkUtility() {
  const qc = useQueryClient();
  const { data: assets = [] } = useQuery(assetsQuery);
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: tags = [] } = useQuery(tagsQuery);
  const { data: assetTags = [] } = useQuery(assetTagsQuery);
  const { data: types = [] } = useQuery(assetTypesQuery);
  const { data: rarities = [] } = useQuery(assetRaritiesQuery);

  const [tagId, setTagId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [rarity, setRarity] = useState("");
  const [typeId, setTypeId] = useState("");

  const [op, setOp] = useState<Op>("set");
  const [energy, setEnergy] = useState<string>("");
  const [credits, setCredits] = useState<string>("");
  const [xp, setXp] = useState<string>("");
  const [preview, setPreview] = useState(false);

  const filtered = useMemo(() => {
    const tagSet = tagId ? new Set(assetTags.filter((t) => t.tag_id === tagId).map((t) => t.asset_id)) : null;
    return assets.filter((a) =>
      (!tagSet || tagSet.has(a.id)) &&
      (!collectionId || a.collection_id === collectionId) &&
      (!rarity || a.rarity === rarity) &&
      (!typeId || a.asset_type_id === typeId)
    );
  }, [assets, assetTags, tagId, collectionId, rarity, typeId]);

  function compute(current: number, raw: string): number | null {
    if (raw === "") return null;
    const n = Number(raw);
    if (Number.isNaN(n)) return null;
    if (op === "set") return n;
    if (op === "add") return Math.max(0, current + n);
    return Math.max(0, current * n);
  }

  const apply = useMutation({
    mutationFn: async () => {
      for (const a of filtered) {
        const patch: Record<string, number> = {};
        const e = compute(a.energy_per_hour ?? 0, energy); if (e !== null) patch.energy_per_hour = e;
        const c = compute(a.credits_per_hour ?? 0, credits); if (c !== null) patch.credits_per_hour = c;
        const x = compute(a.xp_per_hour ?? 0, xp); if (x !== null) patch.xp_per_hour = x;
        if (Object.keys(patch).length === 0) continue;
        const { error } = await sb.from("assets").update(patch).eq("id", a.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets"] }); setPreview(false); },
  });

  return (
    <div className="space-y-3">
      <section className="panel space-y-3 p-3">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-primary">Filter</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Tag"><select className={inputCls} value={tagId} onChange={(e) => setTagId(e.target.value)}>
            <option value="">All</option>{tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></Field>
          <Field label="Collection"><select className={inputCls} value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
            <option value="">All</option>{collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></Field>
          <Field label="Rarity"><select className={inputCls} value={rarity} onChange={(e) => setRarity(e.target.value)}>
            <option value="">All</option>{rarities.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
          </select></Field>
          <Field label="Type"><select className={inputCls} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">All</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></Field>
        </div>
        <p className="text-[11px] text-muted-foreground">{filtered.length} of {assets.length} assets match.</p>
      </section>

      <section className="panel space-y-3 p-3">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-primary">Operation</h3>
        <div className="flex gap-2">
          {(["set", "add", "multiply"] as Op[]).map((o) => (
            <button key={o} onClick={() => setOp(o)}
              className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase ${op === o ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground"}`}>
              {o}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Energy/hr"><input className={inputCls} placeholder="leave blank to skip" value={energy} onChange={(e) => setEnergy(e.target.value)} /></Field>
          <Field label="Credits/hr"><input className={inputCls} placeholder="leave blank to skip" value={credits} onChange={(e) => setCredits(e.target.value)} /></Field>
          <Field label="XP/hr"><input className={inputCls} placeholder="leave blank to skip" value={xp} onChange={(e) => setXp(e.target.value)} /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setPreview(true)} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs hover:border-primary">
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
          <button disabled={!preview || apply.isPending || filtered.length === 0} onClick={() => apply.mutate()}
            className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50">
            <Wand2 className="h-3.5 w-3.5" /> {apply.isPending ? "Applying…" : `Apply to ${filtered.length}`}
          </button>
        </div>
        {apply.error && <p className="text-xs text-destructive">{(apply.error as Error).message}</p>}
      </section>

      {preview && (
        <section className="panel overflow-hidden">
          <div className="bg-surface-2 px-3 py-2 text-[10px] uppercase tracking-widest text-primary">Preview — first 20</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr><th className="px-3 py-2">Asset</th><th className="px-3 py-2">Energy</th><th className="px-3 py-2">Credits</th><th className="px-3 py-2">XP</th></tr>
              </thead>
              <tbody>
                {filtered.slice(0, 20).map((a) => {
                  const ne = compute(a.energy_per_hour ?? 0, energy);
                  const nc = compute(a.credits_per_hour ?? 0, credits);
                  const nx = compute(a.xp_per_hour ?? 0, xp);
                  const cell = (cur: number, next: number | null) =>
                    next === null ? <span className="text-muted-foreground">{cur}</span>
                    : <span><span className="text-muted-foreground line-through">{cur}</span> → <span className="font-bold text-primary">{next}</span></span>;
                  return (
                    <tr key={a.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 font-semibold">{a.name}</td>
                      <td className="px-3 py-2">{cell(a.energy_per_hour ?? 0, ne)}</td>
                      <td className="px-3 py-2">{cell(a.credits_per_hour ?? 0, nc)}</td>
                      <td className="px-3 py-2">{cell(a.xp_per_hour ?? 0, nx)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
