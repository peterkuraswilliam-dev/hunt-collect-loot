import { useQuery } from "@tanstack/react-query";
import { Coins, Zap, Package, Layers, Activity, Heart, Sparkles } from "lucide-react";
import { userStatsTotalsQuery, activityRecentQuery, currenciesQuery } from "../queries";
import { assetsQuery, multipliersQuery } from "@/lib/queries";

function Stat({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: number | string }) {
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
  const { data: totals } = useQuery(userStatsTotalsQuery);
  const { data: recent = [] } = useQuery(activityRecentQuery);
  const { data: currencies = [] } = useQuery(currenciesQuery);
  const { data: assets = [] } = useQuery(assetsQuery);
  const { data: mult } = useQuery(multipliersQuery);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todays = recent.filter((r) => new Date(r.created_at) >= today);
  const energyToday = todays
    .filter((r) => r.kind === "collect_production" || r.kind === "spin")
    .reduce((s, r) => s + Number((r.payload as { energy?: number }).energy ?? 0), 0);
  const packsOpenedToday = todays.filter((r) => r.kind === "open_pack").length;
  const assetsCollectedToday = todays.filter((r) => r.kind === "open_pack").reduce((s, r) => s + ((r.payload as { drops?: unknown[] }).drops?.length ?? 0), 0);

  const health =
    !mult ? "—" :
    mult.production_multiplier >= 1 && mult.credits_multiplier >= 1
      ? "Stable" : "Tuning";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Coins} label="Credits in circulation" value={(totals?.credits ?? 0).toLocaleString()} />
        <Stat icon={Zap} label="Energy generated today" value={energyToday.toLocaleString()} />
        <Stat icon={Sparkles} label="Progression" value="Coming soon" />
        <Stat icon={Package} label="Packs opened today" value={packsOpenedToday} />
        <Stat icon={Layers} label="Assets collected today" value={assetsCollectedToday} />
        <Stat icon={Heart} label="Economy health" value={health} />
        <Stat icon={Coins} label="Currencies" value={currencies.length} />
        <Stat icon={Layers} label="Producing assets" value={assets.filter((a) => (a.credits_per_hour ?? 0) + (a.energy_per_hour ?? 0) > 0).length} />
      </div>

      <div className="panel p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary">
          <Activity className="h-3 w-3" /> Recent activity
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {recent.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                <span className="font-semibold capitalize">{r.kind.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
