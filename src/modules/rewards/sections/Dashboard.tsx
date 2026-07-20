import { useQuery } from "@tanstack/react-query";
import { Gift, Sparkles, CheckCircle2, CircleSlash, Boxes, Link2, RefreshCw, Download, Clock, TrendingUp, AlertTriangle, Archive, Dice5 } from "lucide-react";

import {
  rewardTypesQuery,
  rewardsQuery,
  rewardLogRecentQuery,
  rewardBundlesQuery,
  rewardBundleItemCountsQuery,
  bundleItemsAllQuery,
  allLootTableEntriesQuery,
  lootTablesFullQuery,
  lootTableReferenceCountsQuery,
} from "../queries";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

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
  const { data: rewards = [] } = useQuery(rewardsQuery);
  const { data: recent = [] } = useQuery(rewardLogRecentQuery);
  const { data: bundles = [] } = useQuery(rewardBundlesQuery);
  const { data: bundleCounts = [] } = useQuery(rewardBundleItemCountsQuery);
  const { data: bundleItems = [] } = useQuery(bundleItemsAllQuery);
  const { data: lootEntries = [] } = useQuery(allLootTableEntriesQuery);
  const { data: lootTables = [] } = useQuery(lootTablesLiteQuery);

  const rewardById = new Map(rewards.map((r) => [r.id, r]));
  const lootEntryTotal = lootEntries.length;
  const disabledLootEntries = lootEntries.filter((e) => !e.enabled).length;
  const brokenLootEntries = lootEntries.filter((e) => {
    const r = rewardById.get(e.reward_id);
    return !r || r.archived_at != null;
  }).length;
  const tablesWithEntries = new Set(lootEntries.map((e) => e.loot_table_id));
  const tablesMissingEntries = lootTables.filter((t) => !tablesWithEntries.has(t.id)).length;
  const lootUsageMap = new Map<string, number>();
  for (const e of lootEntries) lootUsageMap.set(e.reward_id, (lootUsageMap.get(e.reward_id) ?? 0) + 1);
  const mostUsedInLoot = Array.from(lootUsageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([rid, n]) => ({ reward: rewardById.get(rid), count: n }))
    .filter((x) => x.reward);

  const active = rewards.filter((r) => r.enabled && !r.archived_at).length;
  const archived = rewards.filter((r) => r.archived_at).length;
  const disabled = rewards.filter((r) => !r.enabled && !r.archived_at).length;
  const activeBundles = bundles.filter((b) => b.enabled).length;
  const typeById = new Map(types.map((t) => [t.id, t]));
  const bundleById = new Map(bundles.map((b) => [b.id, b]));
  const recentlyCreated = [...rewards].slice(0, 10);
  const recentlyUpdated = [...rewards].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10);
  const recentBundles = [...bundles].slice(0, 10);

  const inUseSet = new Set(bundleItems.map((i) => i.reward_id));
  const withoutRefs = rewards.filter((r) => !inUseSet.has(r.id)).length;
  const missingLink = rewards.filter((r) => r.source_kind === "asset" && !r.asset_id).length;
  const nativeRewards = rewards.filter((r) => r.source_kind === "manual").length;

  const usage = new Map<string, number>();
  for (const r of recent) usage.set(r.kind, (usage.get(r.kind) ?? 0) + Number(r.amount || 0));
  const mostUsed = Array.from(usage.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const mostAwarded = [...rewards].sort((a, b) => (b.times_awarded ?? 0) - (a.times_awarded ?? 0)).slice(0, 10);

  const mostUsedBundles = [...bundleCounts]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map((c) => ({ bundle: bundleById.get(c.bundle_id), ...c }))
    .filter((x) => x.bundle);

  const distribution = types
    .map((t) => ({ type: t, count: rewards.filter((r) => r.reward_type_id === t.id).length }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  const linked = rewards.filter((r) => !!r.asset_id);
  const imported = rewards.filter((r) => r.source_kind !== "manual").length;
  const awaitingSync = rewards.filter((r) => r.asset_sync_status === "awaiting_sync").length;
  const orphaned = rewards.filter((r) => r.asset_sync_status === "orphaned").length;
  const lastImport = rewards.filter((r) => r.imported_at).map((r) => new Date(r.imported_at!).getTime()).sort((a, b) => b - a)[0];
  const lastSync = rewards.filter((r) => r.asset_synced_at).map((r) => new Date(r.asset_synced_at!).getTime()).sort((a, b) => b - a)[0];
  const fmt = (t?: number) => (t ? new Date(t).toLocaleDateString() : "—");

  const syncTotal = Math.max(1, linked.length);
  const syncSynced = linked.filter((r) => r.asset_sync_status === "linked").length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Sparkles} label="Reward Types" value={types.length} />
        <Stat icon={Gift} label="Total Rewards" value={rewards.length} />
        <Stat icon={CheckCircle2} label="Active" value={active} />
        <Stat icon={CircleSlash} label="Disabled" value={disabled} />
        <Stat icon={Archive} label="Archived" value={archived} />
        <Stat icon={Boxes} label="Active Bundles" value={activeBundles} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Link2} label="Linked Assets" value={linked.length} />
        <Stat icon={Gift} label="Native Rewards" value={nativeRewards} />
        <Stat icon={Download} label="Imported" value={imported} />
        <Stat icon={AlertTriangle} label="Missing Asset Link" value={missingLink} />
        <Stat icon={AlertTriangle} label="Without References" value={withoutRefs} />
        <Stat icon={RefreshCw} label="Awaiting Sync" value={awaitingSync} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Clock} label="Last Import" value={fmt(lastImport)} />
        <Stat icon={Clock} label="Last Sync" value={fmt(lastSync)} />
        <div className="panel px-3 py-3 col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw className="h-4 w-4 text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Asset Sync Status</span>
            <span className="ml-auto text-xs tabular-nums">{syncSynced}/{syncTotal}</span>
          </div>
          <div className="h-2 rounded bg-surface-2 overflow-hidden flex">
            <div className="bg-emerald-500" style={{ width: `${(syncSynced / syncTotal) * 100}%` }} />
            <div className="bg-amber-500" style={{ width: `${(awaitingSync / syncTotal) * 100}%` }} />
            <div className="bg-red-500" style={{ width: `${(orphaned / syncTotal) * 100}%` }} />
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
            <span><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1" />Linked {syncSynced}</span>
            <span><span className="inline-block h-2 w-2 rounded-full bg-amber-500 mr-1" />Awaiting {awaitingSync}</span>
            <span><span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-1" />Orphaned {orphaned}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Dice5} label="Total Loot Entries" value={lootEntryTotal} />
        <Stat icon={AlertTriangle} label="Tables Missing Entries" value={tablesMissingEntries} />
        <Stat icon={CircleSlash} label="Disabled Loot Entries" value={disabledLootEntries} />
        <Stat icon={AlertTriangle} label="Broken Loot Refs" value={brokenLootEntries} />
      </div>

      <div className="panel p-3">
        <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary">
          <Dice5 className="h-3 w-3" /> Most used rewards in loot tables
        </div>
        {mostUsedInLoot.length === 0 ? <p className="text-xs text-muted-foreground">No loot entries yet.</p> : (
          <ul className="grid gap-1 text-xs md:grid-cols-2">
            {mostUsedInLoot.map((x) => (
              <li key={x.reward!.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                <span className="font-semibold truncate">{x.reward!.name}</span>
                <span className="text-muted-foreground tabular-nums">{x.count} table{x.count === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="panel p-3">
          <div className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary">
            <TrendingUp className="h-3 w-3" /> Most awarded rewards
          </div>
          {mostAwarded.length === 0 ? <p className="text-xs text-muted-foreground">No data yet.</p> : (
            <ul className="space-y-1 text-xs">
              {mostAwarded.map((r) => (
                <li key={r.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                  <span className="font-semibold truncate">{r.name}</span>
                  <span className="text-muted-foreground tabular-nums">{(r.times_awarded ?? 0).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Recently updated rewards</div>
          <ul className="space-y-1 text-xs">
            {recentlyUpdated.map((r) => (
              <li key={r.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                <span className="font-semibold truncate">{r.name}</span>
                <span className="text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>




      <div className="grid gap-3 lg:grid-cols-2">
        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Recently created rewards</div>
          {recentlyCreated.length === 0 ? (
            <p className="text-xs text-muted-foreground">No rewards yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {recentlyCreated.map((r) => {
                const t = typeById.get(r.reward_type_id);
                return (
                  <li key={r.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-muted-foreground">{t?.name ?? "—"} · {new Date(r.created_at).toLocaleDateString()}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Recently created bundles</div>
          {recentBundles.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bundles yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {recentBundles.map((b) => (
                <li key={b.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-muted-foreground">{b.category ?? "—"} · {new Date(b.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Most used rewards</div>
          {mostUsed.length === 0 ? (
            <p className="text-xs text-muted-foreground">No reward activity logged yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {mostUsed.map(([kind, amt]) => (
                <li key={kind} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                  <span className="font-semibold">{kind}</span>
                  <span className="text-muted-foreground">{amt.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Most used bundles</div>
          {mostUsedBundles.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bundles with contents yet.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {mostUsedBundles.map((x) => (
                <li key={x.bundle_id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                  <span className="font-semibold">{x.bundle!.name}</span>
                  <span className="text-muted-foreground">{x.total} rewards · {x.guaranteed}g / {x.random}r</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="panel p-3">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Reward distribution</div>
        {distribution.length === 0 ? (
          <p className="text-xs text-muted-foreground">Add rewards to see distribution.</p>
        ) : (
          <div className="space-y-1.5">
            {distribution.map((d) => (
              <div key={d.type.id} className="flex items-center gap-2 text-xs">
                <div className="w-32 truncate font-semibold">{d.type.name}</div>
                <div className="flex-1 h-3 rounded bg-surface-2 overflow-hidden">
                  <div className="h-full" style={{ width: `${(d.count / maxCount) * 100}%`, background: d.type.color ?? "#8B5CF6" }} />
                </div>
                <div className="w-10 text-right tabular-nums text-muted-foreground">{d.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel p-3">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Recent activity</div>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity logged.</p>
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
