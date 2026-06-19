import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Hexagon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { assetsQuery, collectionsQuery, inventoryQuery } from "@/lib/queries";
import { AssetCard } from "@/components/AssetCard";

export const Route = createFileRoute("/_authenticated/collections")({
  component: Collections,
});

function Collections() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: assets = [] } = useQuery(assetsQuery);
  const { data: inv = [] } = useQuery({ ...inventoryQuery(uid), enabled: !!uid });
  const owned = new Set(inv.map((i) => i.assets.id));

  return (
    <div className="space-y-5">
      <h1 className="px-1 font-display text-xl font-bold uppercase tracking-wider text-primary">Collections</h1>

      {collections.map((c) => {
        const items = assets.filter((a) => a.collection_id === c.id);
        const ownedCount = items.filter((a) => owned.has(a.id)).length;
        const pct = items.length ? Math.round((ownedCount / items.length) * 100) : 0;
        const complete = items.length > 0 && ownedCount === items.length;
        return (
          <section key={c.id} className={`panel-gold p-4 ${complete ? "shimmer-gold" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold uppercase tracking-wider">{c.name}</h2>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{ownedCount} / {items.length}</div>
                <div className="font-display text-lg font-bold text-primary">{pct}%</div>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3 text-credits" /> {c.reward_credits} on complete</span>
              <span className="inline-flex items-center gap-1"><Hexagon className="h-3 w-3 text-xp" /> {c.reward_xp} XP</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {items.map((a) => (
                <AssetCard key={a.id} asset={a} owned={owned.has(a.id)} size="sm" />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
