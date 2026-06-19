import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Coins, Hexagon, Package, Pickaxe, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { meStatsQuery, settingsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import type { Asset, Pack } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/play")({
  component: Play,
});

type DigOutcome =
  | { type: "empty" }
  | { type: "credits"; amount: number }
  | { type: "xp"; amount: number }
  | { type: "asset"; asset: Asset }
  | { type: "pack"; pack: Pack };

function Play() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const qc = useQueryClient();
  const { data: stats } = useQuery({ ...meStatsQuery(uid), enabled: !!uid });
  const { data: settings } = useQuery(settingsQuery);

  const size = settings?.grid_size ?? 5;
  const total = size * size;
  const [dug, setDug] = useState<Record<number, DigOutcome>>({});
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const tiles = useMemo(() => Array.from({ length: total }, (_, i) => i), [total]);

  async function dig(idx: number) {
    if (dug[idx] || busyIdx !== null) return;
    if (!stats || stats.energy < (settings?.dig_energy_cost ?? 1)) {
      toast.error("Not enough energy");
      return;
    }
    setBusyIdx(idx);
    const { data, error } = await supabase.rpc("dig_tile", { p_user: uid });
    setBusyIdx(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as DigOutcome | { error: string };
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setDug((d) => ({ ...d, [idx]: result }));
    qc.invalidateQueries({ queryKey: ["user_stats", uid] });
    if (result.type === "asset") qc.invalidateQueries({ queryKey: ["inventory", uid] });
    if (result.type !== "empty") {
      const txt =
        result.type === "credits" ? `+${result.amount} credits` :
        result.type === "xp" ? `+${result.amount} XP` :
        result.type === "asset" ? `${result.asset.name} (${result.asset.rarity})` :
        `Pack: ${result.pack.name}`;
      toast.success(txt);
    }
  }

  function reset() {
    setDug({});
  }

  return (
    <div className="space-y-4">
      <section className="panel-gold p-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-lg font-bold uppercase tracking-wider text-primary">Treasure Hunt</h1>
          <button onClick={reset} className="text-xs text-muted-foreground underline">Reset grid</button>
        </div>
        <p className="text-xs text-muted-foreground">Dig tiles. Discover rewards.</p>

        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
          {tiles.map((i) => {
            const result = dug[i];
            return (
              <button
                key={i}
                onClick={() => dig(i)}
                disabled={!!result || busyIdx !== null}
                className={`tile ${result ? "dug" : ""}`}
                aria-label={`tile ${i + 1}`}
              >
                {result && <TileReward r={result} />}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Energy cost</span>
          <span className="inline-flex items-center gap-1 font-bold text-energy">
            <Zap className="h-3.5 w-3.5" /> {settings?.dig_energy_cost ?? 1}
          </span>
        </div>
      </section>

      <button
        onClick={() => {
          // dig a random un-dug tile
          const next = tiles.find((i) => !dug[i]);
          if (next !== undefined) dig(next);
        }}
        disabled={busyIdx !== null || !stats || stats.energy < 1}
        className="btn-gold w-full py-3 text-sm"
      >
        <span className="inline-flex items-center gap-2">
          <Pickaxe className="h-4 w-4" /> Dig next tile
        </span>
      </button>
    </div>
  );
}

function TileReward({ r }: { r: DigOutcome }) {
  if (r.type === "empty") return <Sparkles className="h-5 w-5 text-muted-foreground/40" />;
  if (r.type === "credits") return (
    <div className="flex flex-col items-center text-credits">
      <Coins className="h-5 w-5" /><span className="text-[10px] font-bold">+{r.amount}</span>
    </div>
  );
  if (r.type === "xp") return (
    <div className="flex flex-col items-center text-xp">
      <Hexagon className="h-5 w-5" /><span className="text-[10px] font-bold">+{r.amount}</span>
    </div>
  );
  if (r.type === "asset") return (
    <div className={`flex flex-col items-center rarity-${r.asset.rarity}`}>
      <Sparkles className="h-5 w-5" />
      <span className="text-[9px] font-bold uppercase">{r.asset.rarity}</span>
    </div>
  );
  return (
    <div className="flex flex-col items-center text-primary">
      <Package className="h-5 w-5" /><span className="text-[9px] font-bold uppercase">{r.pack.tier}</span>
    </div>
  );
}
