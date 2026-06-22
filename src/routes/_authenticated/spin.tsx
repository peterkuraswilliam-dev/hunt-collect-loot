import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, Ticket } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { meStatsQuery, spinRewardsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import type { SpinResult } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/spin")({ component: SpinPage });

function SpinPage() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const qc = useQueryClient();
  const { data: stats } = useQuery({ ...meStatsQuery(uid), enabled: !!uid });
  const { data: rewards = [] } = useQuery(spinRewardsQuery);
  const active = rewards.filter((r) => r.active);
  const [spinning, setSpinning] = useState(false);
  const [last, setLast] = useState<SpinResult | null>(null);

  const spin = useMutation({
    mutationFn: async (): Promise<SpinResult> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("spin_wheel", { p_user: uid });
      if (error) throw error;
      return data as SpinResult;
    },
    onMutate: () => setSpinning(true),
    onSuccess: (res) => {
      setTimeout(() => {
        setSpinning(false);
        setLast(res);
        qc.invalidateQueries({ queryKey: ["user_stats", uid] });
        qc.invalidateQueries({ queryKey: ["inventory", uid] });
      }, 1400);
    },
    onError: () => setSpinning(false),
  });

  const tokens = stats?.spin_tokens ?? 0;

  return (
    <div className="space-y-4">
      <header className="px-1">
        <h1 className="font-display text-xl font-bold uppercase tracking-wider text-primary">Collection Spins</h1>
        <p className="text-xs text-muted-foreground">Earn spin tokens from collection milestones.</p>
      </header>

      <section className="panel-gold p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-sm">
          <Ticket className="h-4 w-4 text-primary" />
          <span className="font-display text-base font-bold">{tokens}</span>
          <span className="text-muted-foreground">spin tokens</span>
        </div>
        <div className="relative mx-auto my-5 h-48 w-48">
          <div
            className={`absolute inset-0 rounded-full border-4 border-primary bg-gradient-to-br from-amber-500/30 via-surface-2 to-primary/20 shadow-[0_0_40px_rgba(255,180,40,0.4)] transition-transform ${
              spinning ? "animate-spin" : ""
            }`}
            style={{ animationDuration: spinning ? "0.4s" : undefined }}
          >
            <div className="absolute inset-3 grid grid-cols-3 grid-rows-3 items-center justify-items-center text-3xl">
              {active.slice(0, 9).map((r) => <span key={r.id}>{r.icon ?? "🎁"}</span>)}
            </div>
          </div>
          <div className="absolute left-1/2 top-0 -translate-x-1/2 text-2xl text-primary">▼</div>
        </div>
        <button
          onClick={() => spin.mutate()}
          disabled={spin.isPending || spinning || tokens < 1}
          className="btn-gold inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {spinning ? "Spinning…" : tokens < 1 ? "No tokens — complete sets" : "Spin"}
        </button>
        {last && !last.error && last.reward && (
          <div className="mt-4 rounded-md border border-primary/40 bg-primary/10 p-3">
            <div className="text-2xl">{last.reward.icon ?? "🎉"}</div>
            <div className="font-display text-sm font-bold text-primary">{last.reward.label}</div>
            {last.amount ? <div className="text-xs text-muted-foreground">×{last.amount}</div> : null}
          </div>
        )}
        {last?.error && <p className="mt-3 text-xs text-destructive">{last.error}</p>}
      </section>

      <section className="panel space-y-2 p-4">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Possible Rewards</h2>
        <ul className="divide-y divide-border/40 text-xs">
          {active.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-1.5">
              <span className="flex items-center gap-2">
                <span className="text-base">{r.icon ?? "🎁"}</span>
                {r.label}
              </span>
              <span className="text-muted-foreground">w {r.weight}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
