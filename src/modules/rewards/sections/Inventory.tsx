import { useQuery } from "@tanstack/react-query";
import { packsAdminQuery, userPacksTotalsQuery } from "../queries";

export function Inventory() {
  const { data: packs = [] } = useQuery(packsAdminQuery);
  const { data: totals = [] } = useQuery(userPacksTotalsQuery);
  const map = new Map(totals.map((t) => [t.pack_id, t.total]));
  const grand = totals.reduce((s, t) => s + t.total, 0);

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="text-[10px] uppercase tracking-widest text-primary">Total packs in player inventories</div>
        <div className="font-display text-2xl font-extrabold">{grand}</div>
      </div>
      <div className="panel p-3">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Inventory by pack</div>
        <ul className="space-y-1 text-xs">
          {packs.map((p) => (
            <li key={p.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
              <span className="font-semibold">{p.name}</span>
              <span className="text-muted-foreground">{map.get(p.id) ?? 0} held</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] text-muted-foreground">Won packs are added to each player's Pack Inventory and opened later.</p>
    </div>
  );
}
