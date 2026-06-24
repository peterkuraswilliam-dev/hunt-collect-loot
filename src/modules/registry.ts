import type { AssetOSModule } from "./contract";
import { assetsModule } from "./assets";
import { collectionsModule } from "./collections";

export const modules: AssetOSModule[] = [assetsModule, collectionsModule];

export function findModule(slug: string): AssetOSModule | undefined {
  return modules.find((m) => m.slug === slug);
}
