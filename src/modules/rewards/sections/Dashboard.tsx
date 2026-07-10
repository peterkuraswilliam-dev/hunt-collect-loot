import { useQuery } from "@tanstack/react-query";
import { Gift, Sparkles, CheckCircle2, CircleSlash } from "lucide-react";
import { rewardTypesQuery, rewardsQuery, rewardLogRecentQuery } from "../queries";

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

  const active = rewards.filter((r) => r.enabled).length;
  const disabled = rewards.length - active;
  const typeById = new Map(types.map((t) => [t.id, t]));
  const recentlyCreated = [...rewards].slice(0, 10);

  // Most used: aggregate reward_log by kind
  const usage = new Map<string, number>();
  for (const r of recent) usage.set(r.kind, (usage.get(r.kind) ?? 0) + Number(r.amount || 0));
  const mostUsed = Array.from(usage.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Distribution: count of rewards per type
  const distribution = types
    .map((t) => ({ type: t, count: rewards.filter((r) => r.reward_type_id === t.id).length }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={Sparkles} label="Reward Types" value={types.length} />
        <Stat icon={Gift} label="Total Rewards" value={rewards.length} />
        <Stat icon={CheckCircle2} label="Active" value={active} />
        <Stat icon={CircleSlash} label="Disabled" value={disabled} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Recently created</div>
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
          <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Most used</div>
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
                  <div
                    className="h-full"
                    style={{ width: `${(d.count / maxCount) * 100}%`, background: d.type.color ?? "#8B5CF6" }}
                  />
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
