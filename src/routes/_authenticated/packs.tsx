import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Coins, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { packsQuery, meStatsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { PackCard } from "@/components/PackCard";
import { AssetCard } from "@/components/AssetCard";
import type { Asset, Pack } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/packs")({
  component: Packs,
});

function Packs() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const qc = useQueryClient();
  const { data: packs = [] } = useQuery(packsQuery);
  const { data: stats } = useQuery({ ...meStatsQuery(uid), enabled: !!uid });
  const [opening, setOpening] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ pack: Pack; drops: Asset[] } | null>(null);

  async function open(pack: Pack) {
    if (!stats || stats.credits < pack.price_credits) {
      toast.error("Not enough credits");
      return;
    }
    setOpening(pack.id);
    const { data, error } = await supabase.rpc("open_pack", { p_user: uid, p_pack_id: pack.id });
    setOpening(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    const res = data as { pack?: Pack; drops?: Asset[]; error?: string };
    if (res.error) {
      toast.error(res.error);
      return;
    }
    qc.invalidateQueries({ queryKey: ["user_stats", uid] });
    qc.invalidateQueries({ queryKey: ["inventory", uid] });
    if (res.pack && res.drops) setReveal({ pack: res.pack, drops: res.drops });
  }

  return (
    <div className="space-y-4">
      <h1 className="px-1 font-display text-xl font-bold uppercase tracking-wider text-primary">Packs</h1>
      <p className="-mt-3 px-1 text-xs text-muted-foreground">Spend credits to roll new assets.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {packs.map((p) => (
          <PackCard
            key={p.id}
            pack={p}
            onBuy={() => open(p)}
            disabled={opening !== null || !stats || stats.credits < p.price_credits}
          />
        ))}
      </div>

      {reveal && <RevealOverlay pack={reveal.pack} drops={reveal.drops} onClose={() => setReveal(null)} />}
    </div>
  );
}

function RevealOverlay({ pack, drops, onClose }: { pack: Pack; drops: Asset[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-md">
      <div className="panel-gold w-full max-w-md p-5 shimmer-gold">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">You opened</p>
            <h2 className="font-display text-lg font-bold uppercase tracking-wider text-primary">{pack.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-full border border-border p-1.5"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {drops.map((a, i) => <AssetCard key={i} asset={a} size="sm" />)}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Coins className="h-3.5 w-3.5 text-credits" /> -{pack.price_credits}</span>
          <button onClick={onClose} className="btn-gold px-4 py-1.5">Continue</button>
        </div>
      </div>
    </div>
  );
}
