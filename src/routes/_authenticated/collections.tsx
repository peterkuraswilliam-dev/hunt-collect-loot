import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Hexagon, Lock, Sparkles, Ticket } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { assetsQuery, collectionClaimsQuery, collectionsQuery, inventoryQuery } from "@/lib/queries";
import { AssetCard } from "@/components/AssetCard";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionBonus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/collections")({ component: Collections });

function Collections() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const qc = useQueryClient();
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: assets = [] } = useQuery(assetsQuery);
  const { data: inv = [] } = useQuery({ ...inventoryQuery(uid), enabled: !!uid });
  const { data: claims = [] } = useQuery({ ...collectionClaimsQuery(uid), enabled: !!uid });
  const owned = new Set(inv.map((i) => i.assets.id));

  const claim = useMutation({
    mutationFn: async ({ collection_id, threshold }: { collection_id: string; threshold: number }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("claim_collection_bonus", {
        p_user: uid,
        p_collection_id: collection_id,
        p_threshold: threshold,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collection_claims", uid] });
      qc.invalidateQueries({ queryKey: ["user_stats", uid] });
    },
  });

  return (
    <div className="space-y-5">
      <h1 className="px-1 font-display text-xl font-bold uppercase tracking-wider text-primary">Collections</h1>

      {collections.map((c) => {
        const items = assets.filter((a) => a.collection_id === c.id);
        const ownedCount = items.filter((a) => owned.has(a.id)).length;
        const pct = items.length ? (ownedCount / items.length) * 100 : 0;
        const complete = items.length > 0 && ownedCount === items.length;
        const colClaims = new Set(claims.filter((cl) => cl.collection_id === c.id).map((cl) => cl.threshold));
        const bonuses: CollectionBonus[] = Array.isArray(c.bonuses) ? c.bonuses : [];

        return (
          <section key={c.id} className={`panel-gold p-4 ${complete ? "shimmer-gold" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold uppercase tracking-wider">{c.name}</h2>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">{ownedCount} / {items.length}</div>
                <div className="font-display text-lg font-bold text-primary">{Math.round(pct)}%</div>
              </div>
            </div>

            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${pct}%` }} />
            </div>

            <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Coins className="h-3 w-3 text-credits" /> {c.reward_credits} on complete</span>
              <span className="inline-flex items-center gap-1"><Hexagon className="h-3 w-3 text-xp" /> {c.reward_xp} XP</span>
            </div>

            {/* Bonus tiers */}
            {bonuses.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {bonuses
                  .slice()
                  .sort((a, b) => a.threshold - b.threshold)
                  .map((b) => {
                    const eligible = pct >= b.threshold;
                    const claimed = colClaims.has(b.threshold);
                    return (
                      <li
                        key={b.threshold}
                        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] ${
                          claimed
                            ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-200"
                            : eligible
                            ? "border-primary/50 bg-primary/10"
                            : "border-border bg-surface-2/50 text-muted-foreground"
                        }`}
                      >
                        <span className="font-display text-xs font-bold">{b.threshold}%</span>
                        <span className="flex-1 truncate">{b.label ?? bonusLabel(b)}</span>
                        {b.spin_tokens ? (
                          <span className="inline-flex items-center gap-0.5 text-primary"><Ticket className="h-3 w-3" />{b.spin_tokens}</span>
                        ) : null}
                        {claimed ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : eligible ? (
                          <button
                            onClick={() => claim.mutate({ collection_id: c.id, threshold: b.threshold })}
                            disabled={claim.isPending}
                            className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground"
                          >
                            <Sparkles className="-mt-0.5 mr-0.5 inline h-3 w-3" /> Claim
                          </button>
                        ) : (
                          <Lock className="h-3 w-3" />
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}

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

function bonusLabel(b: CollectionBonus) {
  if (b.type === "energy_max") return `+${b.value} Max Energy`;
  if (b.type === "realm_unlock") return `Realm Unlocked`;
  return `Bonus +${b.value}`;
}
