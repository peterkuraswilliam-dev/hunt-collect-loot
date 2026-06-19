import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Pickaxe } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { meStatsQuery, collectionsQuery, inventoryQuery, packsQuery } from "@/lib/queries";
import { PackCard } from "@/components/PackCard";
import heroImg from "@/assets/hero-harbour.jpg";

export const Route = createFileRoute("/_authenticated/home")({
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { data: stats } = useQuery({ ...meStatsQuery(uid), enabled: !!uid });
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: inv = [] } = useQuery({ ...inventoryQuery(uid), enabled: !!uid });
  const { data: packs = [] } = useQuery(packsQuery);

  const totalAssets = inv.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <section className="panel-gold relative overflow-hidden">
        <img src={heroImg} alt="" className="absolute inset-0 h-44 w-full object-cover opacity-70" />
        <div className="absolute inset-0 h-44 bg-gradient-to-r from-background/95 via-background/50 to-transparent" />
        <div className="relative px-4 py-5">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Welcome back</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-wide">ASSET HUNTER</h1>
          <p className="mt-1 text-xs text-primary">Collect. Play. Own.</p>
          <Link to="/play" className="btn-gold mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs">
            <Pickaxe className="h-4 w-4" /> Play Mini Game
          </Link>
        </div>
      </section>

      {/* Stats grid */}
      <section className="panel grid grid-cols-2 gap-px overflow-hidden p-0 text-sm">
        <StatRow label="Total Assets" value={totalAssets} />
        <StatRow label="Collections" value={`${stats?.collections_completed ?? 0} / ${collections.length}`} />
        <StatRow label="Packs Opened" value={stats?.packs_opened ?? 0} />
        <StatRow label="Level" value={stats?.level ?? 1} />
      </section>

      {/* Quick open */}
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
