import { Library, Gauge, Database, Layers, Filter, Gift, Zap, BarChart3, Sparkles, Settings, ShieldCheck } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { Dashboard } from "./sections/Dashboard";
import { Management } from "./sections/Management";
import { Sets } from "./sections/Sets";
import { Rules } from "./sections/Rules";
import { Rewards } from "./sections/Rewards";
import { Bonuses } from "./sections/Bonuses";
import { Analytics } from "./sections/Analytics";
import { Automation } from "./sections/Automation";
import { SettingsSection } from "./sections/SettingsSection";
import { Permissions } from "./sections/Permissions";

export const collectionsModule: AssetOSModule = {
  slug: "collections",
  name: "Collections",
  description: "Tag-driven collections, sets, rewards and bonuses.",
  icon: Library,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "management", label: "Collections", icon: Database, component: Management },
    { key: "sets", label: "Sets", icon: Layers, component: Sets },
    { key: "rules", label: "Rules", icon: Filter, component: Rules },
    { key: "rewards", label: "Rewards", icon: Gift, component: Rewards },
    { key: "bonuses", label: "Bonuses", icon: Zap, component: Bonuses },
    { key: "analytics", label: "Analytics", icon: BarChart3, component: Analytics },
    { key: "automation", label: "Automation", icon: Sparkles, component: Automation },
    { key: "settings", label: "Settings", icon: Settings, component: SettingsSection },
    { key: "permissions", label: "Permissions", icon: ShieldCheck, component: Permissions },
  ],
};
