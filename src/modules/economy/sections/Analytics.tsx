import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { assetsQuery, collectionsQuery } from "@/lib/queries";
import { ownershipStatsQuery } from "@/modules/assets/queries";
import { activityRecentQuery, userStatsTotalsQuery } from "../queries";
import { AdminTable } from "@/components/admin/AdminTable";

export function Analytics() {
  const { data: assets = [] } = useQuery(assetsQuery);
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: ownership = [] } = useQuery(ownershipStatsQuery);
  const { data: recent = [] } = useQuery(activityRecentQuery);
  const { data: totals } = useQuery(userStatsTotalsQuery);

  const ownedById = useMemo(() => new Map(ownership.map((o) => [o.asset_id, o.total])), [ownership]);

  const topAssets = useMemo(() => assets
    .map((a) => {
      const owned = ownedById.get(a.id) ?? 0;
      return {
        id: a.id, name: a.name,
        credits_hr: (a.credits_per_hour ?? 0) * owned,
        energy_hr: (a.energy_per_hour ?? 0) * owned,
        owned,
      };
    })
    .sort((a, b) => (b.credits_hr + b.energy_hr) - (a.credits_hr + a.energy_hr))
    .slice(0, 15), [assets, ownedById]);

  const topCollections = useMemo(() => {
    const map = new Map<string, { id: string; name: string; credits: number; energy: number }>();
    for (const a of assets) {
      if (!a.collection_id) continue;
      const c = collections.find((x) => x.id === a.collection_id);
      if (!c) continue;
      const owned = ownedById.get(a.id) ?? 0;
      const cur = map.get(c.id) ?? { id: c.id, name: c.name, credits: 0, energy: 0 };
      cur.credits += (a.credits_per_hour ?? 0) * owned;
      cur.energy += (a.energy_per_hour ?? 0) * owned;
      map.set(c.id, cur);
    }
    return Array.from(map.values()).sort((a, b) => (b.credits + b.energy) - (a.credits + a.energy)).slice(0, 10);
  }, [assets, collections, ownedById]);

  const flow = useMemo(() => {
    const day = new Map<string, { date: string; credits: number; energy: number }>();
    for (const r of recent) {
      const d = new Date(r.created_at).toLocaleDateString();
      const cur = day.get(d) ?? { date: d, credits: 0, energy: 0 };
      const p = r.payload as { credits?: number; energy?: number; amount?: number; type?: string };
      cur.credits += Number(p.credits ?? (p.type === "credits" ? p.amount ?? 0 : 0));
      cur.energy += Number(p.energy ?? 0);
      day.set(d, cur);
    }
    return Array.from(day.values()).slice(0, 14);
  }, [recent]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Players", totals?.users ?? 0],
          ["Total credits", totals?.credits ?? 0],
          ["Total energy", totals?.energy ?? 0],
          ["Packs opened", totals?.packs_opened ?? 0],
        ].map(([l, v]) => (
          <div key={l as string} className="panel px-3 py-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{l}</div>
            <div className="font-display text-lg font-extrabold">{Number(v).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <section>
        <h3 className="mb-1 font-display text-xs font-bold uppercase tracking-wider text-primary">Top producing assets</h3>
        <AdminTable
          rows={topAssets}
          empty="No production data."
          columns={[
            { key: "name", label: "Asset", render: (r) => <span className="font-semibold">{r.name}</span> },
            { key: "owned", label: "Owned", render: (r) => r.owned },
            { key: "c", label: "Credits/hr (all)", render: (r) => r.credits_hr.toFixed(1) },
            { key: "e", label: "Energy/hr (all)", render: (r) => r.energy_hr.toFixed(1) },
          ]}
        />
      </section>

      <section>
        <h3 className="mb-1 font-display text-xs font-bold uppercase tracking-wider text-primary">Top producing collections</h3>
        <AdminTable
          rows={topCollections}
          empty="No collection production."
          columns={[
            { key: "name", label: "Collection", render: (r) => <span className="font-semibold">{r.name}</span> },
            { key: "c", label: "Credits/hr", render: (r) => r.credits.toFixed(1) },
            { key: "e", label: "Energy/hr", render: (r) => r.energy.toFixed(1) },
          ]}
        />
      </section>

      <section>
        <h3 className="mb-1 font-display text-xs font-bold uppercase tracking-wider text-primary">Currency flow (recent days)</h3>
        <AdminTable
          rows={flow.map((f, i) => ({ id: String(i), ...f }))}
          empty="No flow yet."
          columns={[
            { key: "d", label: "Date", render: (r) => r.date },
            { key: "c", label: "Credits", render: (r) => r.credits },
            { key: "e", label: "Energy", render: (r) => r.energy },
          ]}
        />
      </section>
    </div>
  );
}
