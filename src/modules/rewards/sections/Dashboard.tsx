import { useQuery } from "@tanstack/react-query";
import { Gift, Package, Disc3, Sparkles } from "lucide-react";
import {
  rewardTypesQuery,
  packsAdminQuery,
  spinsQuery,
  rewardBundlesQuery,
  rewardLogRecentQuery,
  userPacksTotalsQuery,
} from "../queries";

function Stat({ icon: Icon, label, value }: { icon: typeof Gift; label: string; value: number | string }) {
  return (
    <div className="panel flex items-center gap-3 px-3 py-3">
      <Icon className="h-5 w-5 text-primary" />
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-display text-lg font-extrabold">{value}</div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data: types = [] } = useQuery(rewardTypesQuery);
  const { data: packs = [] } = useQuery(packsAdminQuery);
  const { data: spins = [] } = useQuery(spinsQuery);
  const { data: bundles = [] } = useQuery(rewardBundlesQuery);
  const { data: recent = [] } = useQuery(rewardLogRecentQuery);
  const { data: packTotals = [] } = useQuery(userPacksTotalsQuery);

  const opened = recent.filter((r) => r.source === "packs").length;
  const claimed = recent.length;
  const packsOwned = packTotals.reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Gift} label="Reward Types" value={types.length} />
        <Stat icon={Package} label="Packs" value={packs.length} />
        <Stat icon={Disc3} label="Spin Wheels" value={spins.length} />
        <Stat icon={Sparkles} label="Bundles" value={bundles.length} />
        <Stat icon={Package} label="Packs in inventory" value={packsOwned} />
        <Stat icon={Gift} label="Rewards claimed" value={claimed} />
        <Stat icon={Package} label="Packs opened" value={opened} />
        <Stat icon={Sparkles} label="Recent events" value={recent.length} />
      </div>

      <div className="panel p-3">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Recent rewards</div>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">No rewards logged yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {recent.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                <span className="font-semibold">{r.kind}</span>
                <span className="text-muted-foreground">{r.source} · {new Date(r.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
