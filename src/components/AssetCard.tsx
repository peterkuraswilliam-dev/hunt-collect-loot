import { Compass } from "lucide-react";
import type { Asset } from "@/lib/types";
import { RarityBadge } from "./RarityBadge";

const RARITY_BG: Record<string, string> = {
  common: "from-slate-700/60 to-slate-900/80",
  rare: "from-sky-700/60 to-slate-900/90",
  epic: "from-violet-700/60 to-slate-900/90",
  legendary: "from-amber-600/70 to-slate-900/90",
};

export function AssetCard({
  asset,
  owned = true,
  quantity,
  size = "md",
}: {
  asset: Asset;
  owned?: boolean;
  quantity?: number;
  size?: "sm" | "md";
}) {
  const heightCls = size === "sm" ? "h-28" : "h-40";
  return (
    <div className={`panel-gold relative overflow-hidden ${owned ? "" : "opacity-40 saturate-0"}`}>
      <div className={`relative ${heightCls} bg-gradient-to-br ${RARITY_BG[asset.rarity]}`}>
        {asset.image_url ? (
          <img
            src={asset.image_url}
            alt={asset.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-primary/40">
            <Compass className="h-12 w-12" strokeWidth={1.2} />
          </div>
        )}
        <div className="absolute left-2 top-2"><RarityBadge rarity={asset.rarity} /></div>
        {quantity && quantity > 1 && (
          <div className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-bold text-primary">
            ×{quantity}
          </div>
        )}
      </div>
      <div className="px-3 py-2">
        <div className="truncate font-display text-sm font-semibold">{asset.name}</div>
      </div>
    </div>
  );
}
