import type { Rarity } from "@/lib/types";

const LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export function RarityBadge({ rarity, className = "" }: { rarity: Rarity; className?: string }) {
  return (
    <span
      className={`rarity-${rarity} inline-flex items-center rounded-full border bg-background/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${className}`}
    >
      {LABEL[rarity]}
    </span>
  );
}
