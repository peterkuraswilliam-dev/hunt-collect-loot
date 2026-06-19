import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { inventoryQuery } from "@/lib/queries";
import { AssetCard } from "@/components/AssetCard";
import type { Rarity } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: Inventory,
});

const FILTERS: Array<Rarity | "all"> = ["all", "common", "rare", "epic", "legendary"];

function Inventory() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { data: inv = [] } = useQuery({ ...inventoryQuery(uid), enabled: !!uid });
  const [filter, setFilter] = useState<Rarity | "all">("all");

  const items = inv.filter((i) => filter === "all" || i.assets.rarity === filter);

  return (
    <div className="space-y-3">
      <h1 className="px-1 font-display text-xl font-bold uppercase tracking-wider text-primary">Inventory</h1>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
              filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          No assets yet — dig tiles or open a pack to start collecting.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((i) => <AssetCard key={i.assets.id} asset={i.assets} quantity={i.quantity} />)}
        </div>
      )}
    </div>
  );
}
