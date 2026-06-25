import { useQuery } from "@tanstack/react-query";
import { packsAdminQuery, rewardLogRecentQuery, userPacksTotalsQuery } from "../queries";

export function Analytics() {
  const { data: log = [] } = useQuery(rewardLogRecentQuery);
  const { data: packs = [] } = useQuery(packsAdminQuery);
  const { data: totals = [] } = useQuery(userPacksTotalsQuery);

  const byKind = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const r of log) {
    byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
    bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1);
  }
  const topPacks = [...packs]
    .map((p) => ({ p, total: totals.find((t) => t.pack_id === p.id)?.total ?? 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Reward distribution</div>
          <ul className="space-y-1 text-xs">
            {[...byKind.entries()].map(([k, n]) => (
              <li key={k} className="flex justify-between"><span>{k}</span><span className="text-muted-foreground">{n}</span></li>
            ))}
            {byKind.size === 0 && <li className="text-muted-foreground">No data yet.</li>}
          </ul>
        </div>
        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">By source</div>
          <ul className="space-y-1 text-xs">
            {[...bySource.entries()].map(([k, n]) => (
              <li key={k} className="flex justify-between"><span>{k}</span><span className="text-muted-foreground">{n}</span></li>
            ))}
            {bySource.size === 0 && <li className="text-muted-foreground">No data yet.</li>}
          </ul>
        </div>
      </div>
      <div className="panel p-3">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Most held packs</div>
        <ul className="space-y-1 text-xs">
          {topPacks.map(({ p, total }) => (
            <li key={p.id} className="flex justify-between"><span>{p.name}</span><span className="text-muted-foreground">{total}</span></li>
          ))}
          {!topPacks.length && <li className="text-muted-foreground">No packs.</li>}
        </ul>
      </div>
    </div>
  );
}
