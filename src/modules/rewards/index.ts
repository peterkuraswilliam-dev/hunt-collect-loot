import { Gift, Gauge, Sparkles, Library, Settings } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { Dashboard } from "./sections/Dashboard";
import { RewardTypes } from "./sections/RewardTypes";
import { RewardsLibrary } from "./sections/RewardsLibrary";
import { SettingsSection } from "./sections/SettingsSection";

export const rewardsModule: AssetOSModule = {
  slug: "rewards",
  name: "Rewards",
  description: "CMS-first source of truth for reward types and the reward library.",
  icon: Gift,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "types", label: "Reward Types", icon: Sparkles, component: RewardTypes },
    { key: "library", label: "Rewards Library", icon: Library, component: RewardsLibrary },
    { key: "settings", label: "Settings", icon: Settings, component: SettingsSection },
  ],
};
