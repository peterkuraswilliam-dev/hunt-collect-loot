import { useQuery } from "@tanstack/react-query";
import { Activity, Gauge, Pickaxe, Sparkles } from "lucide-react";
import { miningSettingsQuery, MINING_MODULE_VERSION } from "../settings";

const STATUS_TONE: Record<string, string> = {
  enabled: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  beta: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  maintenance: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  disabled: "text-muted-foreground border-border bg-surface-2",
};

export function MiningDashboard() {
  const { data: s } = useQuery(miningSettingsQuery);
  if (!s) return <div className="panel p-4 text-xs text-muted-foreground">Loading…</div>;

  const activeAreas = Object.values(s.content.areas).filter(Boolean).length;
  const activeRocks = Object.values(s.content.rocks).filter(Boolean).length;
  const activePickaxes = Object.values(s.content.pickaxes).filter(Boolean).length;
  const activeLoot = Object.values(s.content.loot).filter(Boolean).length;

  const tiles = [
    { label: "Status", value: s.status, Icon: Activity },
    { label: "Version", value: MINING_MODULE_VERSION, Icon: Sparkles },
    { label: "XP Mult", value: `x${s.economy.xp_multiplier}`, Icon: Gauge },
    { label: "Loot Mult", value: `x${s.economy.loot_multiplier}`, Icon: Pickaxe },
  ];

  return (
    <div className="space-y-3">
      <div className={`panel border px-3 py-2 text-xs uppercase tracking-widest ${STATUS_TONE[s.status] ?? ""}`}>
        Mining module · {s.status}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="panel p-3">
            <div className="text-[10px] uppercase tracking-widest text-primary flex items-center gap-1">
              <t.Icon className="h-3 w-3" /> {t.label}
            </div>
            <div className="mt-1 font-display text-xl font-extrabold capitalize">{t.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Areas" value={activeAreas} />
        <StatTile label="Rocks" value={activeRocks} />
        <StatTile label="Pickaxes" value={activePickaxes} />
        <StatTile label="Loot" value={activeLoot} />
      </div>
      <div className="panel p-3 text-xs text-muted-foreground">
        Runtime is lazy-loaded. Sprites, sounds and game logic only download when a player opens the Mining page.
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label} active</div>
      <div className="mt-1 font-display text-2xl font-extrabold">{value}</div>
    </div>
  );
}
