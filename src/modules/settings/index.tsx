import { Settings as SettingsIcon, Gauge, ToggleLeft, ShieldCheck, KeyRound, Sliders } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ModuleSettingsPanel, ModulePermissionsPanel } from "../_shared/ModuleSettings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Toggle = { key: string; enabled: boolean; description: string | null };

function Dashboard() {
  const { data: toggles = [] } = useQuery({
    queryKey: ["feature_toggles"],
    queryFn: async () => {
      const { data, error } = await sb.from("feature_toggles").select("*").order("key");
      if (error) throw error;
      return (data ?? []) as Toggle[];
    },
  });
  const on = toggles.filter((t) => t.enabled).length;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div className="panel p-3"><div className="text-[10px] uppercase tracking-widest text-primary">Total toggles</div><div className="mt-1 font-display text-2xl font-extrabold">{toggles.length}</div></div>
      <div className="panel p-3"><div className="text-[10px] uppercase tracking-widest text-primary">Enabled</div><div className="mt-1 font-display text-2xl font-extrabold">{on}</div></div>
      <div className="panel p-3"><div className="text-[10px] uppercase tracking-widest text-primary">Disabled</div><div className="mt-1 font-display text-2xl font-extrabold">{toggles.length - on}</div></div>
    </div>
  );
}

function FeatureToggles() {
  const qc = useQueryClient();
  const { data: toggles = [] } = useQuery({
    queryKey: ["feature_toggles"],
    queryFn: async () => {
      const { data, error } = await sb.from("feature_toggles").select("*").order("key");
      if (error) throw error;
      return (data ?? []) as Toggle[];
    },
  });
  const flip = useMutation({
    mutationFn: async (t: Toggle) => {
      const { error } = await sb.from("feature_toggles").update({ enabled: !t.enabled }).eq("key", t.key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature_toggles"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="panel p-3">
      <ul className="space-y-1 text-xs">
        {toggles.map((t) => (
          <li key={t.key} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
            <div>
              <div className="font-semibold">{t.key}</div>
              {t.description && <div className="text-[10px] text-muted-foreground">{t.description}</div>}
            </div>
            <button onClick={() => flip.mutate(t)} className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${t.enabled ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface-2 text-muted-foreground"}`}>{t.enabled ? "On" : "Off"}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Roles() {
  const { data: rows = [] } = useQuery({
    queryKey: ["all_user_roles"],
    queryFn: async () => {
      const { data, error } = await sb.from("user_roles").select("user_id, role");
      if (error) throw error;
      return (data ?? []) as Array<{ user_id: string; role: string }>;
    },
  });
  return (
    <div className="panel p-3 text-xs">
      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Assigned roles</p>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={`${r.user_id}-${r.role}-${i}`} className="flex justify-between border-b border-border/40 py-1 last:border-0">
            <span>{r.user_id.slice(0, 8)}…</span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">{r.role}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-muted-foreground">No roles assigned.</li>}
      </ul>
      <p className="mt-2 text-[10px] text-muted-foreground">Promote / revoke admins from the Users module.</p>
    </div>
  );
}

const Platform = () => <ModuleSettingsPanel module="platform" />;

export const settingsModule: AssetOSModule = {
  slug: "settings",
  name: "Settings",
  description: "Platform settings, feature toggles, roles & permissions.",
  icon: SettingsIcon,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "platform", label: "Platform", icon: Sliders, component: Platform },
    { key: "toggles", label: "Feature Toggles", icon: ToggleLeft, component: FeatureToggles },
    { key: "roles", label: "Roles", icon: KeyRound, component: Roles },
    { key: "permissions", label: "Permissions", icon: ShieldCheck, component: () => <ModulePermissionsPanel module="settings" /> },
  ],
};
