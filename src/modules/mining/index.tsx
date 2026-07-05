import { Pickaxe, Gauge, Settings as SettingsIcon, Layers, ShieldCheck, BarChart3 } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { ModulePermissionsPanel } from "../_shared/ModuleSettings";
import { MiningDashboard } from "./sections/Dashboard";
import { MiningSettingsSection } from "./sections/Settings";
import { MiningContentSection } from "./sections/Content";
import { MINING_MODULE_ID } from "./settings";

export const MINING_MODULE_META = {
  id: MINING_MODULE_ID,
  name: "Mining",
  description: "Modular Mining mini game — CMS-driven settings, lazy-loaded runtime.",
  version: "1.0.0-beta",
  route: "/mining",
  category: "mini_game" as const,
};

const Analytics = () => (
  <div className="panel p-3 text-xs text-muted-foreground">
    Mining analytics will surface here once the runtime emits play events.
  </div>
);

export const miningModule: AssetOSModule = {
  slug: MINING_MODULE_ID,
  name: MINING_MODULE_META.name,
  description: MINING_MODULE_META.description,
  icon: Pickaxe,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: MiningDashboard },
    { key: "settings", label: "Settings", icon: SettingsIcon, component: MiningSettingsSection },
    { key: "content", label: "Content", icon: Layers, component: MiningContentSection },
    { key: "analytics", label: "Analytics", icon: BarChart3, component: Analytics },
    {
      key: "permissions",
      label: "Permissions",
      icon: ShieldCheck,
      component: () => <ModulePermissionsPanel module={MINING_MODULE_ID} />,
    },
  ],
};
