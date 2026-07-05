import type { AssetOSModule } from "./contract";
import { assetsModule } from "./assets";
import { collectionsModule } from "./collections";
import { rewardsModule } from "./rewards";
import { economyModule } from "./economy";
import { progressionModule } from "./progression";
import { gamesModule } from "./games";
import { usersModule } from "./users";
import { automationModule } from "./automation";
import { settingsModule } from "./settings";
import { miningModule } from "./mining";

export const modules: AssetOSModule[] = [
  assetsModule,
  collectionsModule,
  rewardsModule,
  economyModule,
  progressionModule,
  gamesModule,
  miningModule,
  usersModule,
  automationModule,
  settingsModule,
];

export function findModule(slug: string): AssetOSModule | undefined {
  return modules.find((m) => m.slug === slug);
}

