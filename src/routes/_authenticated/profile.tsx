import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Hexagon, LogOut, Shield, User, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { meStatsQuery, settingsQuery, collectionsQuery, inventoryQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id ?? "";
  const { data: stats } = useQuery({ ...meStatsQuery(uid), enabled: !!uid });
  const { data: settings } = useQuery(settingsQuery);
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: inv = [] } = useQuery({ ...inventoryQuery(uid), enabled: !!uid });
  const { isAdmin } = useIsAdmin();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const xpInLevel = stats ? stats.xp % (settings?.xp_per_level ?? 500) : 0;
  const xpPct = settings ? Math.round((xpInLevel / settings.xp_per_level) * 100) : 0;

  return (
    <div className="space-y-4">
      <section className="panel-gold p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-amber-500 to-amber-800">
            <User className="h-7 w-7 text-background" />
          </div>
          <div className="flex-1">
            <div className="font-display text-lg font-bold">{user?.email?.split("@")[0] ?? "Hunter"}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-primary">Level</div>
            <div className="font-display text-2xl font-extrabold">{stats?.level ?? 1}</div>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>XP</span><span>{xpInLevel} / {settings?.xp_per_level ?? 500}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-to-r from-violet-400 to-violet-600" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        <StatTile icon={<Coins className="h-4 w-4 text-credits" />} label="Credits" value={stats?.credits ?? 0} />
        <StatTile icon={<Zap className="h-4 w-4 text-energy" />} label="Energy" value={`${stats?.energy ?? 0}/${settings?.energy_max ?? 100}`} />
        <StatTile icon={<Hexagon className="h-4 w-4 text-xp" />} label="Total XP" value={stats?.xp ?? 0} />
      </section>

      <section className="panel p-4 space-y-2 text-sm">
        <Row label="Assets owned" value={inv.reduce((s, i) => s + i.quantity, 0)} />
        <Row label="Unique assets" value={inv.length} />
        <Row label="Collections completed" value={`${stats?.collections_completed ?? 0} / ${collections.length}`} />
        <Row label="Packs opened" value={stats?.packs_opened ?? 0} />
        <Row label="Joined" value={stats ? new Date(stats.joined_at).toLocaleDateString() : "—"} />
      </section>

      {isAdmin && (
        <Link to="/admin" className="btn-gold flex w-full items-center justify-center gap-2 py-3 text-sm">
          <Shield className="h-4 w-4" /> Open Admin CMS
        </Link>
      )}

      <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-2 py-3 text-sm font-semibold">
        <LogOut className="h-4 w-4" /> Sign out
      </button>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-center gap-1">{icon}</div>
      <div className="mt-1 font-display text-base font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-display font-bold">{value}</span>
    </div>
  );
}
