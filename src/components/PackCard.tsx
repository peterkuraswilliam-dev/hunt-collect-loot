import { Coins } from "lucide-react";
import type { Pack } from "@/lib/types";
import bronze from "@/assets/pack-bronze.png";
import silver from "@/assets/pack-silver.png";
import gold from "@/assets/pack-gold.png";

const ART: Record<string, string> = { bronze, silver, gold };
const TIER_GLOW: Record<string, string> = {
  bronze: "shadow-[0_0_30px_oklch(0.65_0.16_50/0.35)]",
  silver: "shadow-[0_0_30px_oklch(0.78_0.18_230/0.35)]",
  gold: "shadow-[0_0_36px_oklch(0.82_0.18_70/0.45)]",
};

export function PackCard({ pack, onBuy, disabled }: { pack: Pack; onBuy?: () => void; disabled?: boolean }) {
  const art = ART[pack.tier] ?? bronze;
  return (
    <div className={`panel-gold flex flex-col items-center px-3 pb-3 pt-4 ${TIER_GLOW[pack.tier] ?? ""}`}>
      <img src={art} alt={pack.name} className="h-32 w-auto object-contain drop-shadow-2xl" loading="lazy" />
      <div className="mt-2 text-center font-display text-sm font-bold uppercase tracking-wider">{pack.name}</div>
      <div className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-credits">
        <Coins className="h-4 w-4" /> {pack.price_credits.toLocaleString()}
      </div>
      {onBuy && (
        <button onClick={onBuy} disabled={disabled} className="btn-gold mt-3 w-full px-3 py-2 text-xs">
          Open
        </button>
      )}
    </div>
  );
}
