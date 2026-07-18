
ALTER TABLE public.loot_table_entries ADD COLUMN IF NOT EXISTS admin_notes text;
CREATE UNIQUE INDEX IF NOT EXISTS loot_table_entries_unique_reward
  ON public.loot_table_entries(loot_table_id, reward_id);
