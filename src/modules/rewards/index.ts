import { Gift, Gauge, Sparkles, Package, Filter, Disc3, Boxes, Archive, Plug, BarChart3, Settings, ShieldCheck } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { Dashboard } from "./sections/Dashboard";
import { RewardTypes } from "./sections/RewardTypes";
import { Packs } from "./sections/Packs";
import { PackPools } from "./sections/PackPools";
import { Spins } from "./sections/Spins";
import { Bundles } from "./sections/Bundles";
import { Inventory } from "./sections/Inventory";
import { Sources } from "./sections/Sources";
import { Analytics } from "./sections/Analytics";
import { SettingsSection } from "./sections/SettingsSection";
import { Permissions } from "./sections/Permissions";

export const rewardsModule: AssetOSModule = {
  slug: "rewards",
  name: "Rewards",
  description: "Tag-driven rewards: types, packs, pools, spins, bundles, inventory, sources.",
  icon: Gift,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "types", label: "Reward Types", icon: Sparkles, component: RewardTypes },
    { key: "packs", label: "Packs", icon: Package, component: Packs },
    { key: "pools", label: "Pack Pools", icon: Filter, component: PackPools },
    { key: "spins", label: "Spins", icon: Disc3, component: Spins },
    { key: "bundles", label: "Bundles", icon: Boxes, component: Bundles },
    { key: "inventory", label: "Inventory", icon: Archive, component: Inventory },
    { key: "sources", label: "Sources", icon: Plug, component: Sources },
    { key: "analytics", label: "Analytics", icon: BarChart3, component: Analytics },
    { key: "settings", label: "Settings", icon: Settings, component: SettingsSection },
    { key: "permissions", label: "Permissions", icon: ShieldCheck, component: Permissions },
  ],
};
