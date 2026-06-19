import { Coins, Hexagon, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { meStatsQuery, settingsQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";

export function StatBar() {
  const { user } = useAuth();
  const { data: settings } = useQuery(settingsQuery);
  const { data: stats } = useQuery({ ...meStatsQuery(user?.id ?? ""), enabled: !!user });

  if (!stats || !settings) return <div className="h-12" />;
  return (
    <div className="flex items-center gap-2 px-3 pt-3">
      <div className="stat-chip flex-1 justify-center text-sm">
        <Coins className="h-4 w-4 text-credits" />
        <span>{stats.credits.toLocaleString()}</span>
      </div>
      <div className="stat-chip flex-1 justify-center text-sm">
        <Zap className="h-4 w-4 text-energy" />
        <span>{stats.energy}/{settings.energy_max}</span>
      </div>
      <div className="stat-chip flex-1 justify-center text-sm">
        <Hexagon className="h-4 w-4 text-xp" />
        <span>{stats.xp.toLocaleString()}</span>
      </div>
    </div>
  );
}
