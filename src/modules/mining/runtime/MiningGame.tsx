import { useEffect, useRef, useState } from "react";
import { Pickaxe } from "lucide-react";
import type { MiningSettings } from "../settings";
import { miningHooks } from "./hooks";

/**
 * Lazy-only runtime for the Mining mini game.
 *
 * This module is imported via React.lazy from the /mining route ONLY, so its
 * bundle (and any future sprites, sounds, particle systems, or PixiJS logic)
 * is not fetched until a player actually opens the page.
 */
export default function MiningGame({ settings }: { settings: MiningSettings }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(0);
  const [durability, setDurability] = useState(100);

  const activeAreas = Object.entries(settings.content.areas)
    .filter(([, on]) => on)
    .map(([slug]) => slug);
  const activeRocks = Object.entries(settings.content.rocks)
    .filter(([, on]) => on)
    .map(([slug]) => slug);
  const areaSlug = activeAreas[0] ?? "iron_cavern";
  const rockSlug = activeRocks[0] ?? "stone";

  // Placeholder render loop — replace with PixiJS scene when installed.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    const draw = () => {
      t += 0.02;
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = `hsl(${(t * 40) % 360} 60% 50% / 0.15)`;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 60 + Math.sin(t) * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e5c66b";
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(rockSlug.toUpperCase(), canvas.width / 2, canvas.height / 2 + 4);
      raf = requestAnimationFrame(draw);
    };
    draw();
    miningHooks.trackAnalytics("mining.session_start", { areaSlug });
    return () => {
      cancelAnimationFrame(raf);
      miningHooks.trackAnalytics("mining.session_end", { areaSlug });
    };
  }, [areaSlug, rockSlug]);

  const swing = () => {
    if (durability <= 0) return;
    const ctx = { areaSlug, rockSlug, pickaxeSlug: "iron_pick" };
    const crit = settings.gameplay.critical_hits && Math.random() < 0.15;
    const xpGain = Math.round(10 * settings.economy.xp_multiplier * (crit ? 2 : 1));
    const coinGain = Math.round(5 * settings.economy.coin_multiplier * (crit ? 2 : 1));
    if (settings.gameplay.xp_rewards) {
      setXp((v) => v + xpGain);
      void miningHooks.awardXP(ctx, xpGain);
    }
    if (settings.gameplay.coin_rewards) {
      setCoins((v) => v + coinGain);
      void miningHooks.grantReward(ctx, "coins", coinGain);
    }
    if (settings.gameplay.pickaxe_upgrades) setDurability((v) => Math.max(0, v - 1));
    if (settings.gameplay.random_events && Math.random() < 0.05) {
      miningHooks.fireEvent("vein_strike");
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="XP" value={xp} />
        <Stat label="Coins" value={coins} />
        <Stat label="Pickaxe" value={`${durability}%`} />
      </div>
      <div className="panel overflow-hidden">
        <canvas ref={canvasRef} width={320} height={200} className="mx-auto block bg-black" />
      </div>
      <button
        onClick={swing}
        disabled={durability <= 0}
        className="btn-gold w-full inline-flex items-center justify-center gap-2 py-3 disabled:opacity-50"
      >
        <Pickaxe className="h-4 w-4" /> Swing pickaxe
      </button>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center">
        Area: {areaSlug} · Rock: {rockSlug}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-2">
      <div className="text-[10px] uppercase tracking-widest text-primary">{label}</div>
      <div className="font-display text-lg font-extrabold">{value}</div>
    </div>
  );
}
