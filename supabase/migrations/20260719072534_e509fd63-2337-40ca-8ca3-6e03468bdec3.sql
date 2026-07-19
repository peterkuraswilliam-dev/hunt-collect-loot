
ALTER TABLE public.loot_tables
  ADD COLUMN IF NOT EXISTS fixed_roll_count integer,
  ADD COLUMN IF NOT EXISTS selection_method text NOT NULL DEFAULT 'weighted_random',
  ADD COLUMN IF NOT EXISTS quantity_multiplier numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_total_quantity integer,
  ADD COLUMN IF NOT EXISTS max_total_quantity integer;

ALTER TABLE public.loot_tables
  DROP CONSTRAINT IF EXISTS loot_tables_selection_method_check;
ALTER TABLE public.loot_tables
  ADD CONSTRAINT loot_tables_selection_method_check
  CHECK (selection_method IN ('weighted_random','independent','guaranteed_only','all'));
