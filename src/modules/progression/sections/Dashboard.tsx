import { useQuery } from "@tanstack/react-query";
import { Layers, LineChart as LineIcon, ListOrdered, Zap, TrendingUp, BarChart3, Sparkles } from "lucide-react";
import {
  progressionTypesQuery,
  xpCurvesQuery,
  progressionLevelsQuery,
  xpSourcesQuery,
  xpMultipliersQuery,
} from "../queries";

function Stat({ label, value, Icon }: { label: string; value: string | number; Icon: typeof Layers }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <p className="mt-1 font-display text-xl font-extrabold">{value}</p>
    </div>
  );
}

export function Dashboard() {
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const { data: curves = [] } = useQuery(xpCurvesQuery);
  const { data: levels = [] } = useQuery(progressionLevelsQuery);
  const { data: sources = [] } = useQuery(xpSourcesQuery);
  const { data: mults = [] } = useQuery(xpMultipliersQuery);

  const activeCurves = curves.filter((c) => c.status === "active").length;
  const activeMults = mults.filter((m) => m.status === "active").length;
  const enabledSources = sources.filter((s) => s.enabled).length;
  const maxLevel = types.reduce((m, t) => Math.max(m, t.max_level), 0);
  const recent = [...types, ...curves, ...sources].slice(0, 5);

  const sourceByCat = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Progression Types" value={types.length} Icon={Layers} />
        <Stat label="Active XP Curves" value={activeCurves} Icon={LineIcon} />
        <Stat label="Max Configured Level" value={maxLevel} Icon={ListOrdered} />
        <Stat label="XP Sources" value={`${enabledSources}/${sources.length}`} Icon={Zap} />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Active Multipliers" value={activeMults} Icon={TrendingUp} />
        <Stat label="Total Levels" value={levels.length} Icon={ListOrdered} />
        <Stat label="Curves" value={curves.length} Icon={LineIcon} />
        <Stat label="Multipliers" value={mults.length} Icon={TrendingUp} />
      </div>

      <div className="panel p-3">
        <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary">
          <BarChart3 className="h-3 w-3" /> XP Sources by Category
        </p>
        {Object.keys(sourceByCat).length === 0 ? (
          <p className="text-xs text-muted-foreground">No sources yet.</p>
        ) : (
          <div className="space-y-1.5">
            {Object.entries(sourceByCat).map(([cat, count]) => {
              const pct = (count / sources.length) * 100;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-[11px]">
                    <span className="capitalize">{cat}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="panel p-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Active Curves</p>
          <ul className="space-y-1 text-xs">
            {curves.filter((c) => c.status === "active").slice(0, 6).map((c) => (
              <li key={c.id} className="flex justify-between">
                <span>{c.name}</span>
                <span className="text-muted-foreground">{c.growth_type} · max {c.max_level}</span>
              </li>
            ))}
            {curves.length === 0 && <li className="text-muted-foreground">No curves yet.</li>}
          </ul>
        </div>
        <div className="panel p-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Recent Changes</p>
          <ul className="space-y-1 text-xs">
            {recent.length === 0 && <li className="text-muted-foreground">Nothing yet.</li>}
            {recent.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>{(r as { name: string }).name}</span>
                <span className="text-muted-foreground">{(r as { slug: string }).slug}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel-gold flex items-center gap-2 p-3 text-xs">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">
          Progression analytics are CMS-driven. Wire XP sources, curves, and multipliers — analytics will follow.
        </span>
      </div>
    </div>
  );
}
