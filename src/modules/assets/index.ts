import { Boxes, BarChart3, Database, Gauge, Layers, Settings, ShieldCheck, Sparkles, Tags, Factory } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { Dashboard } from "./sections/Dashboard";
import { Management } from "./sections/Management";
import { Types } from "./sections/Types";
import { Rarities } from "./sections/Rarities";
import { TagsSection } from "./sections/TagsSection";
import { Utility as Production } from "./sections/Utility";
import { Analytics } from "./sections/Analytics";
import { SettingsSection } from "./sections/SettingsSection";
import { Permissions } from "./sections/Permissions";

export const assetsModule: AssetOSModule = {
  slug: "assets",
  name: "Assets",
  description: "Assets, types, rarities, tags and asset production.",
  icon: Boxes,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "management", label: "Assets", icon: Database, component: Management },
    { key: "types", label: "Types", icon: Layers, component: Types },
    { key: "rarities", label: "Rarities", icon: Sparkles, component: Rarities },
    { key: "tags", label: "Tags", icon: Tags, component: TagsSection },
    { key: "production", label: "Production", icon: Factory, component: Production },
    { key: "analytics", label: "Analytics", icon: BarChart3, component: Analytics },
    { key: "settings", label: "Settings", icon: Settings, component: SettingsSection },
    { key: "permissions", label: "Permissions", icon: ShieldCheck, component: Permissions },
  ],
};
