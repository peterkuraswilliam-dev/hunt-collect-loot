import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Boxes, Coins, Library, Package, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: counts } = useQuery({
    queryKey: ["admin_counts"],
    queryFn: async () => {
      const [assets, collections, packs, profiles, stats, activity] = await Promise.all([
        supabase.from("assets").select("id", { count: "exact", head: true }),
        supabase.from("collections").select("id", { count: "exact", head: true }),
        supabase.from("packs").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_stats").select("credits, xp, packs_opened"),
        supabase.from("activity_log").select("id", { count: "exact", head: true }),
      ]);
      const credits = (stats.data ?? []).reduce((s, r) => s + (r.credits ?? 0), 0);
      const xp = (stats.data ?? []).reduce((s, r) => s + (r.xp ?? 0), 0);
      const packsOpened = (stats.data ?? []).reduce((s, r) => s + (r.packs_opened ?? 0), 0);
      return {
        assets: assets.count ?? 0,
        collections: collections.count ?? 0,
        packs: packs.count ?? 0,
        users: profiles.count ?? 0,
        activity: activity.count ?? 0,
        credits,
        xp,
        packsOpened,
      };
    },
  });

  const tiles = [
    { label: "Assets", value: counts?.assets ?? 0, Icon: Boxes },
    { label: "Collections", value: counts?.collections ?? 0, Icon: Library },
    { label: "Packs", value: counts?.packs ?? 0, Icon: Package },
    { label: "Users", value: counts?.users ?? 0, Icon: Users },
    { label: "Total Credits", value: counts?.credits ?? 0, Icon: Coins },
    { label: "Packs Opened", value: counts?.packsOpened ?? 0, Icon: Package },
    { label: "Actions Logged", value: counts?.activity ?? 0, Icon: Zap },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="panel p-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary">
            <t.Icon className="h-3.5 w-3.5" />
            {t.label}
          </div>
          <div className="mt-1 font-display text-2xl font-extrabold">{t.value}</div>
        </div>
      ))}
    </div>
  );
}
