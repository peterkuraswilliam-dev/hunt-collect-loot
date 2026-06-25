import type { AssetOSModule } from "./contract";
import { assetsModule } from "./assets";
import { collectionsModule } from "./collections";
import { rewardsModule } from "./rewards";

export const modules: AssetOSModule[] = [assetsModule, collectionsModule, rewardsModule];

export function findModule(slug: string): AssetOSModule | undefined {
  return modules.find((m) => m.slug === slug);
}
