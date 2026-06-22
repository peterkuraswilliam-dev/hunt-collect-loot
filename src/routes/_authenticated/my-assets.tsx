import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Coins, Hexagon, Zap, Sparkles, Hammer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { inventoryQuery, meStatsQuery, multipliersQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { calcTotals, fmt, pendingProduction } from "@/lib/production";
import { RarityBadge } from "@/components/RarityBadge";
import type { CollectProductionResult } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/my-assets")({ component: MyAssets });

function MyAssets() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const qc = useQueryClient();
  const { data: inv = [] } = useQuery({ ...inventoryQuery(uid), enabled: !!uid });
  const { data: stats } = useQuery({ ...meStatsQuery(uid), enabled: !!uid });
  const { data: mult } = useQuery(multipliersQuery);
  const totals = calcTotals(inv, mult ?? null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);
  void tick;
  const pending = pendingProduction(stats, totals, mult?.max_offline_hours ?? 24);

  const collect = useMutation({
    mutationFn: async (): Promise<CollectProductionResult> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("collect_production", { p_user: uid });
      if (error) throw error;
      return data as CollectProductionResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_stats", uid] });
    },
  });

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-bold uppercase tracking-wider text-primary">My Assets</h1>
        <p className="text-xs text-muted-foreground">Your collection generates resources around the clock.</p>
      </header>

      {/* Production summary */}
      <section className="panel-gold space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat icon={<Coins className="h-4 w-4 text-credits" />} label="Credits / hr" value={fmt(totals.creditsPerHour)} />
          <Stat icon={<Zap className="h-4 w-4 text-energy" />} label="Energy / hr" value={fmt(totals.energyPerHour)} />
          <Stat icon={<Hexagon className="h-4 w-4 text-xp" />} label="XP / hr" value={fmt(totals.xpPerHour)} />
        </div>
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Pending ({pending.hours.toFixed(2)}h)</span>
            <span>Max {mult?.max_offline_hours ?? 24}h</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-sm font-bold">
            <span className="flex items-center gap-1 text-credits"><Coins className="h-3.5 w-3.5" />{pending.credits}</span>
            <span className="flex items-center gap-1 text-energy"><Zap className="h-3.5 w-3.5" />{pending.energy}</span>
            <span className="flex items-center gap-1 text-xp"><Hexagon className="h-3.5 w-3.5" />{pending.xp}</span>
          </div>
        </div>
        <button
          onClick={() => collect.mutate()}
          disabled={collect.isPending || pending.credits + pending.xp + pending.energy === 0}
          className="btn-gold inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {collect.isPending ? "Collecting…" : "Collect Production"}
        </button>
        {collect.data && !collect.data.error && (
          <p className="text-center text-xs text-primary">
            +{collect.data.credits} credits · +{collect.data.energy} energy · +{collect.data.xp} XP
          </p>
        )}
      </section>

      {/* Asset list */}
      {inv.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          <Hammer className="mx-auto mb-2 h-8 w-8 opacity-50" />
          No assets yet — dig tiles or open a pack to start your empire.
        </div>
      ) : (
        <ul className="space-y-2">
          {[...inv]
            .sort((a, b) => (b.assets.credits_per_hour ?? 0) * b.quantity - (a.assets.credits_per_hour ?? 0) * a.quantity)
            .map((row) => (
              <li key={row.assets.id} className="panel flex items-center gap-3 p-2">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-2">
                  {row.assets.image_url && (
                    <img src={row.assets.image_url} alt={row.assets.name} className="h-full w-full object-cover" loading="lazy" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-sm font-semibold">{row.assets.name}</span>
                    <RarityBadge rarity={row.assets.rarity} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 text-credits">
                      <Coins className="h-3 w-3" />{fmt((row.assets.credits_per_hour ?? 0) * row.quantity)}/h
                    </span>
                    <span className="flex items-center gap-1 text-energy">
                      <Zap className="h-3 w-3" />{fmt((row.assets.energy_per_hour ?? 0) * row.quantity)}/h
                    </span>
                    <span className="flex items-center gap-1 text-xp">
                      <Hexagon className="h-3 w-3" />{fmt((row.assets.xp_per_hour ?? 0) * row.quantity)}/h
                    </span>
                  </div>
                </div>
                <div className="rounded-md bg-surface-2 px-2 py-1 text-xs font-bold text-primary">×{row.quantity}</div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-2">
      <div className="flex items-center justify-center gap-1">{icon}<span className="font-display text-base font-bold">{value}</span></div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
