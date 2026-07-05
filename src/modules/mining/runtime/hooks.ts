/**
 * Integration surface for the Mining runtime.
 *
 * These are intentionally thin no-op stubs. Each has a single call site inside
 * the runtime so wiring live systems (progression, inventory, rewards, etc.)
 * becomes a one-file change per hook.
 */

export interface MiningRewardContext {
  playerId?: string;
  areaSlug: string;
  rockSlug: string;
  pickaxeSlug: string;
}

export const miningHooks = {
  awardXP: async (_ctx: MiningRewardContext, amount: number) => {
    console.debug("[mining] awardXP", amount);
  },
  grantReward: async (_ctx: MiningRewardContext, rewardSlug: string, qty: number) => {
    console.debug("[mining] grantReward", rewardSlug, qty);
  },
  addToInventory: async (_ctx: MiningRewardContext, itemSlug: string, qty: number) => {
    console.debug("[mining] addToInventory", itemSlug, qty);
  },
  unlockAsset: async (_ctx: MiningRewardContext, assetSlug: string) => {
    console.debug("[mining] unlockAsset", assetSlug);
  },
  trackAnalytics: (event: string, payload?: Record<string, unknown>) => {
    console.debug("[mining] analytics", event, payload);
  },
  emitNotification: (message: string) => {
    console.debug("[mining] notify", message);
  },
  checkAchievement: async (_ctx: MiningRewardContext, achievementSlug: string) => {
    console.debug("[mining] checkAchievement", achievementSlug);
  },
  craft: async (recipeSlug: string) => {
    console.debug("[mining] craft", recipeSlug);
  },
  listOnMarketplace: async (itemSlug: string, price: number) => {
    console.debug("[mining] listOnMarketplace", itemSlug, price);
  },
  fireEvent: (eventSlug: string) => {
    console.debug("[mining] fireEvent", eventSlug);
  },
};
