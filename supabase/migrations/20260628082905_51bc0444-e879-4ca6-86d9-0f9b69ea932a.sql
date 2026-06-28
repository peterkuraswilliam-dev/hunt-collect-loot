-- Remove Treasure Hunt server logic
DROP FUNCTION IF EXISTS public.dig_tile(uuid);

-- Drop unused Treasure Hunt columns from game settings
ALTER TABLE public.game_settings
  DROP COLUMN IF EXISTS dig_energy_cost,
  DROP COLUMN IF EXISTS grid_size,
  DROP COLUMN IF EXISTS treasure_rewards;

-- Reset all player data (keep auth users, roles, profiles, CMS configuration)
TRUNCATE TABLE
  public.user_inventory,
  public.user_packs,
  public.user_collection_claims,
  public.activity_log,
  public.reward_log
RESTART IDENTITY;

-- Reset stats for every existing player back to defaults
UPDATE public.user_stats SET
  credits = 0,
  xp = 0,
  level = 1,
  energy = 0,
  energy_updated_at = now(),
  packs_opened = 0,
  collections_completed = 0,
  spin_tokens = 0,
  bonus_energy_max = 0,
  production_collected_at = now();
