import { Coins, Gauge, Banknote, Zap, TrendingUp, Scale, Wrench, BarChart3, Settings, ShieldCheck, Sparkles } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { Dashboard } from "./sections/Dashboard";
import { Currencies } from "./sections/Currencies";
import { Energy } from "./sections/Energy";
import { Multipliers } from "./sections/Multipliers";
import { Balancing } from "./sections/Balancing";
import { BulkUtility } from "./sections/BulkUtility";
import { Analytics } from "./sections/Analytics";
import { SettingsSection } from "./sections/SettingsSection";
import { Permissions } from "./sections/Permissions";
import { Progression } from "./sections/Progression";

export const economyModule: AssetOSModule = {
  slug: "economy",
  name: "Economy",
  description: "Currencies, energy, multipliers, balancing & bulk utility.",
  icon: Coins,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "currencies", label: "Currencies", icon: Banknote, component: Currencies },
    { key: "energy", label: "Energy", icon: Zap, component: Energy },
    { key: "multipliers", label: "Multipliers", icon: TrendingUp, component: Multipliers },
    { key: "balancing", label: "Balancing", icon: Scale, component: Balancing },
    { key: "progression", label: "Progression", icon: Sparkles, component: Progression },
    { key: "bulk", label: "Bulk Utility", icon: Wrench, component: BulkUtility },
    { key: "analytics", label: "Analytics", icon: BarChart3, component: Analytics },
    { key: "settings", label: "Settings", icon: Settings, component: SettingsSection },
    { key: "permissions", label: "Permissions", icon: ShieldCheck, component: Permissions },
  ],
};
