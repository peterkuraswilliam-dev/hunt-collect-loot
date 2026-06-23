import { useQuery } from "@tanstack/react-query";
import { assetsQuery } from "@/lib/queries";
import { ownershipStatsQuery } from "../queries";

export function Analytics() {
  const { data: assets = [] } = useQuery(assetsQuery);
  const { data: ownership = [] } = useQuery(ownershipStatsQuery);

  const ownMap = new Map(ownership.map((o) => [o.asset_id, o.total]));
  const enriched = assets.map((a) => ({ ...a, owned: ownMap.get(a.id) ?? 0 }));
  const mostCollected = [...enriched].sort((a, b) => b.owned - a.owned).slice(0, 10);
  const topProducers = [...assets].sort((a, b) => (b.credits_per_hour ?? 0) - (a.credits_per_hour ?? 0)).slice(0, 10);

  // Growth: assets created per week
  const buckets = new Map<string, number>();
  for (const a of assets) {
    const d = new Date(a.created_at);
    const week = `${d.getUTCFullYear()}-W${Math.ceil((d.getUTCDate() + d.getUTCDay()) / 7)}`;
    buckets.set(week, (buckets.get(week) ?? 0) + 1);
  }
  const growth = Array.from(buckets.entries()).sort();

  const totalOwned = ownership.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="panel p-3"><p className="text-[10px] uppercase text-muted-foreground">Total Assets</p><p className="font-display text-xl font-bold">{assets.length}</p></div>
        <div className="panel p-3"><p className="text-[10px] uppercase text-muted-foreground">Copies Owned</p><p className="font-display text-xl font-bold">{totalOwned}</p></div>
        <div className="panel p-3"><p className="text-[10px] uppercase text-muted-foreground">Unique Holders</p><p className="font-display text-xl font-bold">{ownership.length}</p></div>
      </div>

      <div className="panel p-3">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Most Collected</p>
        <ol className="space-y-1 text-xs">
          {mostCollected.map((a, i) => (
            <li key={a.id} className="flex justify-between"><span>{i + 1}. {a.name}</span><span className="font-bold">{a.owned}</span></li>
          ))}
        </ol>
      </div>

      <div className="panel p-3">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Top Credit Producers (/hr)</p>
        <ol className="space-y-1 text-xs">
          {topProducers.map((a, i) => (
            <li key={a.id} className="flex justify-between"><span>{i + 1}. {a.name}</span><span className="font-bold">{(a.credits_per_hour ?? 0).toFixed(1)}</span></li>
          ))}
        </ol>
      </div>

      <div className="panel p-3">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Asset Growth (per week)</p>
        <div className="flex items-end gap-1 overflow-x-auto">
          {growth.map(([w, n]) => (
            <div key={w} className="flex flex-col items-center gap-1">
              <div className="w-6 rounded-t bg-primary" style={{ height: `${Math.min(80, n * 10)}px` }} />
              <span className="text-[9px] text-muted-foreground">{w}</span>
              <span className="text-[10px] font-bold">{n}</span>
            </div>
          ))}
          {growth.length === 0 && <p className="text-xs text-muted-foreground">No data.</p>}
        </div>
      </div>
    </div>
  );
}
