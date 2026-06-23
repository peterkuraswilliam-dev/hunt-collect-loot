import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

export type ModuleSectionKey =
  | "dashboard"
  | "management"
  | "types"
  | "rarities"
  | "tags"
  | "utility"
  | "analytics"
  | "automation"
  | "settings"
  | "permissions";

export interface ModuleSection {
  key: ModuleSectionKey;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
}

export interface AssetOSModule {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
  sections: ModuleSection[];
}
