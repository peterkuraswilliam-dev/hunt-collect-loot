import type { Asset, EconomyMultipliers, UserStats } from "./types";

export interface InventoryRow {
  quantity: number;
  assets: Asset;
}

export interface ProductionTotals {
  energyPerHour: number;
  creditsPerHour: number;
  xpPerHour: number;
}

export function calcTotals(inv: InventoryRow[], mult?: EconomyMultipliers | null): ProductionTotals {
  const pm = mult?.production_multiplier ?? 1;
  const cm = mult?.credits_multiplier ?? 1;
  const em = mult?.energy_production_multiplier ?? 1;
  let energy = 0;
  let credits = 0;
  let xp = 0;
  for (const row of inv) {
    energy += (row.assets.energy_per_hour ?? 0) * row.quantity;
    credits += (row.assets.credits_per_hour ?? 0) * row.quantity;
    xp += (row.assets.xp_per_hour ?? 0) * row.quantity;
  }
  return {
    energyPerHour: energy * pm * em,
    creditsPerHour: credits * pm * cm,
    xpPerHour: xp * pm,
  };
}

export function pendingProduction(
  stats: UserStats | undefined,
  totals: ProductionTotals,
  maxOfflineHours = 24,
) {
  if (!stats) return { credits: 0, energy: 0, xp: 0, hours: 0 };
  const elapsedMs = Date.now() - new Date(stats.production_collected_at).getTime();
  const hours = Math.min(maxOfflineHours, Math.max(0, elapsedMs / 3600_000));
  return {
    credits: Math.floor(totals.creditsPerHour * hours),
    energy: Math.floor(totals.energyPerHour * hours),
    xp: Math.floor(totals.xpPerHour * hours),
    hours,
  };
}


export function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(n < 10 ? 1 : 0);
}
