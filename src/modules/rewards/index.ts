import { Gift, Gauge, Sparkles, Library, Settings, Boxes, Dice5, Send, Inbox } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { Dashboard } from "./sections/Dashboard";
import { RewardTypes } from "./sections/RewardTypes";
import { RewardsLibrary } from "./sections/RewardsLibrary";
import { Bundles } from "./sections/Bundles";
import { LootTables } from "./sections/LootTables";
import { Distribution } from "./sections/Distribution";
import { PlayerInboxes } from "./sections/PlayerInboxes";
import { SettingsSection } from "./sections/SettingsSection";

export const rewardsModule: AssetOSModule = {
  slug: "rewards",
  name: "Rewards",
  description: "CMS-first source of truth for reward types, library, bundles, loot tables, and distribution.",
  icon: Gift,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "types", label: "Reward Types", icon: Sparkles, component: RewardTypes },
    { key: "library", label: "Rewards Library", icon: Library, component: RewardsLibrary },
    { key: "bundles", label: "Reward Bundles", icon: Boxes, component: Bundles },
    { key: "loot", label: "Loot Tables", icon: Dice5, component: LootTables },
    { key: "distribution", label: "Reward Distribution", icon: Send, component: Distribution },
    { key: "inboxes", label: "Player Inboxes", icon: Inbox, component: PlayerInboxes },
    { key: "settings", label: "Settings", icon: Settings, component: SettingsSection },
  ],
};


