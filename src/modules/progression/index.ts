import {
  Sparkles,
  Gauge,
  Layers,
  LineChart,
  ListOrdered,
  Zap,
  TrendingUp,
  Moon,
  Rocket,
  Crown,
  BarChart3,
  FlaskConical,
  Settings,
  ShieldCheck,
} from "lucide-react";
import type { AssetOSModule } from "../contract";
import { Dashboard } from "./sections/Dashboard";
import { ProgressionTypes } from "./sections/ProgressionTypes";
import { XPCurves } from "./sections/XPCurves";
import { Levels } from "./sections/Levels";
import { XPSources } from "./sections/XPSources";
import { Multipliers } from "./sections/Multipliers";
import { RestedXP } from "./sections/RestedXP";
import { CatchUpXP } from "./sections/CatchUpXP";
import { Prestige } from "./sections/Prestige";
import { Analytics } from "./sections/Analytics";
import { Simulator } from "./sections/Simulator";
import { SettingsSection } from "./sections/SettingsSection";
import { Permissions } from "./sections/Permissions";

export const progressionModule: AssetOSModule = {
  slug: "progression",
  name: "Experience & Progression",
  description: "CMS-driven progression types, XP curves, levels, sources and multipliers.",
  icon: Sparkles,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "types", label: "Progression Types", icon: Layers, component: ProgressionTypes },
    { key: "curves", label: "XP Curves", icon: LineChart, component: XPCurves },
    { key: "levels", label: "Levels", icon: ListOrdered, component: Levels },
    { key: "sources", label: "XP Sources", icon: Zap, component: XPSources },
    { key: "multipliers", label: "Multipliers", icon: TrendingUp, component: Multipliers },
    { key: "rested", label: "Rested XP", icon: Moon, component: RestedXP },
    { key: "catchup", label: "Catch-Up XP", icon: Rocket, component: CatchUpXP },
    { key: "prestige", label: "Prestige", icon: Crown, component: Prestige },
    { key: "analytics", label: "Analytics", icon: BarChart3, component: Analytics },
    { key: "simulator", label: "Simulator", icon: FlaskConical, component: Simulator },
    { key: "settings", label: "Settings", icon: Settings, component: SettingsSection },
    { key: "permissions", label: "Permissions", icon: ShieldCheck, component: Permissions },
  ],
};
