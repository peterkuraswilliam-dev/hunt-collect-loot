import { Users as UsersIcon, Gauge, Database, Wallet, Package, TrendingUp, BarChart3, Settings, ShieldCheck, Shield, ShieldOff } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable } from "@/components/admin/AdminTable";
import { ModuleSettingsPanel, ModulePermissionsPanel } from "../_shared/ModuleSettings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["users_module_dashboard"],
    queryFn: async () => {
      const [{ count: users }, { data: stats }] = await Promise.all([
        sb.from("profiles").select("id", { count: "exact", head: true }),
        sb.from("user_stats").select("credits, xp, level, packs_opened"),
      ]);
      const totals = (stats ?? []).reduce(
        (acc: { credits: number; xp: number; packs: number }, r: { credits: number; xp: number; packs_opened: number }) => {
          acc.credits += r.credits ?? 0;
          acc.xp += r.xp ?? 0;
          acc.packs += r.packs_opened ?? 0;
          return acc;
        },
        { credits: 0, xp: 0, packs: 0 },
      );
      return { users: users ?? 0, ...totals };
    },
  });
  const tiles = [
    { label: "Players", value: data?.users ?? 0 },
    { label: "Total credits", value: data?.credits ?? 0 },
    { label: "Total XP", value: data?.xp ?? 0 },
    { label: "Packs opened", value: data?.packs ?? 0 },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="panel p-3">
          <div className="text-[10px] uppercase tracking-widest text-primary">{t.label}</div>
          <div className="mt-1 font-display text-2xl font-extrabold">{Number(t.value).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function Wallets() {
  const { data: rows = [] } = useQuery({
    queryKey: ["users_wallets"],
    queryFn: async () => {
      const [{ data: profiles }, { data: stats }] = await Promise.all([
        sb.from("profiles").select("id, username"),
        sb.from("user_stats").select("user_id, credits, energy, xp, spin_tokens"),
      ]);
      return (profiles ?? []).map((p: { id: string; username: string | null }) => {
        const s = (stats ?? []).find((x: { user_id: string }) => x.user_id === p.id);
        return { id: p.id, username: p.username, ...s };
      });
    },
  });
  return (
    <div className="panel p-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground"><th>User</th><th>Credits</th><th>Energy</th><th>XP</th><th>Spins</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border/40">
              <td className="py-1">{r.username ?? r.id.slice(0, 6)}</td>
              <td>{r.credits ?? 0}</td><td>{r.energy ?? 0}</td><td>{r.xp ?? 0}</td><td>{r.spin_tokens ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Inventory() {
  const { data: rows = [] } = useQuery({
    queryKey: ["users_inventory_totals"],
    queryFn: async () => {
      const { data, error } = await sb.from("user_inventory").select("user_id, quantity");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as Array<{ user_id: string; quantity: number }>) {
        map.set(r.user_id, (map.get(r.user_id) ?? 0) + r.quantity);
      }
      return Array.from(map.entries()).map(([user_id, qty]) => ({ user_id, qty }));
    },
  });
  return (
    <div className="panel p-3 text-xs">
      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Inventory totals per user</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.user_id} className="flex justify-between border-b border-border/40 py-1 last:border-0"><span>{r.user_id.slice(0, 8)}…</span><span>{r.qty} items</span></li>
        ))}
      </ul>
    </div>
  );
}

function Progression() {
  const { data: rows = [] } = useQuery({
    queryKey: ["users_progression"],
    queryFn: async () => {
      const { data } = await sb.from("user_stats").select("user_id, level, xp, collections_completed").order("level", { ascending: false });
      return (data ?? []) as Array<{ user_id: string; level: number; xp: number; collections_completed: number }>;
    },
  });
  return (
    <div className="panel p-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground"><th>User</th><th>Level</th><th>XP</th><th>Collections</th></tr></thead>
        <tbody>
          {rows.map((r) => <tr key={r.user_id} className="border-t border-border/40"><td>{r.user_id.slice(0, 8)}…</td><td>{r.level}</td><td>{r.xp}</td><td>{r.collections_completed}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

const Analytics = () => <div className="panel p-3 text-xs text-muted-foreground">Cohort & retention analytics coming soon.</div>;

export const usersModule: AssetOSModule = {
  slug: "users",
  name: "Users",
  description: "Players, wallets, inventory and progression.",
  icon: UsersIcon,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "management", label: "Users", icon: Database, component: UsersPage },
    { key: "wallet", label: "Wallet", icon: Wallet, component: Wallets },
    { key: "inventory", label: "Inventory", icon: Package, component: Inventory },
    { key: "progression", label: "Progression", icon: TrendingUp, component: Progression },
    { key: "analytics", label: "Analytics", icon: BarChart3, component: Analytics },
    { key: "settings", label: "Settings", icon: Settings, component: () => <ModuleSettingsPanel module="users" /> },
    { key: "permissions", label: "Permissions", icon: ShieldCheck, component: () => <ModulePermissionsPanel module="users" /> },
  ],
};
