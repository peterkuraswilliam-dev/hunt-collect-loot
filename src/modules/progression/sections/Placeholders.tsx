import type { LucideIcon } from "lucide-react";
import { Moon, Rocket, Crown, BarChart3, FlaskConical } from "lucide-react";

function Placeholder({ Icon, title, body }: { Icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="panel-gold space-y-2 p-6 text-center">
      <Icon className="mx-auto h-7 w-7 text-primary" />
      <h2 className="font-display text-base font-extrabold uppercase tracking-wider">{title}</h2>
      <p className="text-xs text-muted-foreground">{body}</p>
      <p className="text-[10px] uppercase tracking-widest text-primary">Coming soon</p>
    </div>
  );
}

export const RestedXP = () => (
  <Placeholder
    Icon={Moon}
    title="Rested XP"
    body="Configure how players accumulate rested XP while offline and how it applies on return. Coming in a future release."
  />
);
export const CatchUpXP = () => (
  <Placeholder
    Icon={Rocket}
    title="Catch-Up XP"
    body="Boost XP gains for players behind the curve. Configuration UI lands in a future release."
  />
);
export const Prestige = () => (
  <Placeholder
    Icon={Crown}
    title="Prestige"
    body="Define prestige tiers, requirements and resets. Coming soon."
  />
);
export const Analytics = () => (
  <Placeholder
    Icon={BarChart3}
    title="Progression Analytics"
    body="XP gain rates, level distribution, source breakdowns and curve health. Coming soon."
  />
);
export const Simulator = () => (
  <Placeholder
    Icon={FlaskConical}
    title="Progression Simulator"
    body="Test curves, sources and multipliers against synthetic player profiles. Coming soon."
  />
);
