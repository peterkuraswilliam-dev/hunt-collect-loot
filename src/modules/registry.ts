import type { AssetOSModule } from "./contract";
import { assetsModule } from "./assets";

export const modules: AssetOSModule[] = [assetsModule];

export function findModule(slug: string): AssetOSModule | undefined {
  return modules.find((m) => m.slug === slug);
}
