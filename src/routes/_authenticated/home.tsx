import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Hexagon, Package, Sparkles, Ticket, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  collectionsQuery,
  inventoryQuery,
  meStatsQuery,
  multipliersQuery,
  packsQuery,
} from "@/lib/queries";
import { usePlayerProgression } from "@/lib/usePlayerProgression";
import { PackCard } from "@/components/PackCard";
import { calcTotals, fmt, pendingProduction } from "@/lib/production";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero-harbour.jpg";
import type { CollectProductionResult } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/home")({ component: Home });

function Home() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const qc = useQueryClient();
  const { data: stats } = useQuery({ ...meStatsQuery(uid), enabled: !!uid });
  const { level } = usePlayerProgression(uid);
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: inv = [] } = useQuery({ ...inventoryQuery(uid), enabled: !!uid });
  const { data: packs = [] } = useQuery(packsQuery);
  const { data: mult } = useQuery(multipliersQuery);
  const totals = calcTotals(inv, mult ?? null);
  const pending = pendingProduction(stats, totals, mult?.max_offline_hours ?? 24);
  const totalAssets = inv.reduce((sum, i) => sum + i.quantity, 0);

  const collect = useMutation({
    mutationFn: async (): Promise<CollectProductionResult> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("collect_production", { p_user: uid });
      if (error) throw error;
      return data as CollectProductionResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_stats", uid] });
      qc.invalidateQueries({ queryKey: ["subject_progression", uid] });
      qc.invalidateQueries({ queryKey: ["prog_next_xp"] });
    },
  });

  return (
    <div className="space-y-4">
      <section className="panel-gold relative overflow-hidden">
        <img src={heroImg} alt="" className="absolute inset-0 h-44 w-full object-cover opacity-70" />
        <div className="absolute inset-0 h-44 bg-gradient-to-r from-background/95 via-background/50 to-transparent" />
        <div className="relative px-4 py-5">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Welcome back</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-wide">ASSET HUNTER</h1>
          <p className="mt-1 text-xs text-primary">Collect. Own. Earn while away.</p>
          <Link to="/packs" className="btn-gold mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs">
            <Package className="h-4 w-4" /> Open Packs
          </Link>
        </div>
      </section>

      {/* Production banner */}
      <section className="panel-gold p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-primary">Pending Production</p>
            <p className="text-xs text-muted-foreground">{pending.hours.toFixed(2)} hrs of resources waiting</p>
          </div>
          <Link to="/my-assets" className="text-[11px] text-primary underline">My Assets →</Link>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm font-bold">
          <span className="flex items-center justify-center gap-1 text-credits"><Coins className="h-3.5 w-3.5" />{pending.credits}</span>
          <span className="flex items-center justify-center gap-1 text-energy"><Zap className="h-3.5 w-3.5" />{pending.energy}</span>
          <span className="flex items-center justify-center gap-1 text-primary"><Star className="h-3.5 w-3.5" />{pending.xp}</span>
        </div>
        <div className="mt-2 text-center text-[10px] text-muted-foreground">
          {fmt(totals.creditsPerHour)} cr/h · {fmt(totals.energyPerHour)} en/h · {fmt(totals.xpPerHour)} xp/h
        </div>
        <button
          onClick={() => collect.mutate()}
          disabled={collect.isPending || pending.credits + pending.energy + pending.xp === 0}
          className="btn-gold mt-3 inline-flex w-full items-center justify-center gap-2 py-2 text-xs disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" /> Collect Now
        </button>
      </section>


      {/* Stats grid */}
      <section className="panel grid grid-cols-2 gap-px overflow-hidden p-0 text-sm">
        <StatRow label="Total Assets" value={totalAssets} />
        <StatRow label="Collections" value={`${stats?.collections_completed ?? 0} / ${collections.length}`} />
        <StatRow label="Packs Opened" value={stats?.packs_opened ?? 0} />
        <StatRow label="Level" value={level} />
      </section>

      {/* Spin tokens */}
      {(stats?.spin_tokens ?? 0) > 0 && (
        <Link to="/spin" className="panel-gold flex items-center justify-between p-3">
          <span className="flex items-center gap-2 text-sm">
            <Ticket className="h-4 w-4 text-primary" />
            You have <strong className="font-display">{stats?.spin_tokens}</strong> spin token{stats?.spin_tokens === 1 ? "" : "s"}
          </span>
          <span className="text-xs text-primary">Spin →</span>
        </Link>
      )}

      <section>
        <SectionHeader title="Quick Open" subtitle="Open a pack now!" />
        <div className="grid grid-cols-3 gap-2">
          {packs.map((p) => (
            <Link key={p.id} to="/packs"><PackCard pack={p} /></Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-2 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-primary">{label}</div>
      <div className="font-display text-lg font-bold">{value}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-2 flex items-end justify-between px-1">
      <div>
        <h2 className="font-display text-base font-bold uppercase tracking-wider text-primary">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
