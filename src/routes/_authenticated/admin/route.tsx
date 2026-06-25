import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Coins, Gauge, Gift, Layers, Library, ShieldAlert, TrendingUp, Users } from "lucide-react";
import { useIsAdmin } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const TABS = [
  { to: "/admin", label: "Dashboard", Icon: Gauge },
  { to: "/admin/modules/assets", label: "Assets", Icon: Layers },
  { to: "/admin/modules/collections", label: "Collections", Icon: Library },
  { to: "/admin/modules/rewards", label: "Rewards", Icon: Gift },
  { to: "/admin/economy", label: "Economy", Icon: Coins },
  { to: "/admin/multipliers", label: "Multipliers", Icon: TrendingUp },
  { to: "/admin/users", label: "Users", Icon: Users },
] as const;

function AdminLayout() {
  const { isAdmin, loading } = useIsAdmin();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!isAdmin) {
    return (
      <div className="panel p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-destructive" />
        <h2 className="mt-2 font-display text-lg font-bold">Admin only</h2>
        <p className="text-sm text-muted-foreground">You do not have access to the CMS.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="panel-gold flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Super Admin</p>
          <h1 className="font-display text-lg font-extrabold tracking-wide">CMS Console</h1>
        </div>
      </header>

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {TABS.map(({ to, label, Icon }) => {
          const active = to === "/admin" ? pathname === "/admin" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
