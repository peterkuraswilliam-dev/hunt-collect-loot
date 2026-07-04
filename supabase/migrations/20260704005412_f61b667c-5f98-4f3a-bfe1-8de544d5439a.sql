
-- Extend progression_levels with editor fields
ALTER TABLE public.progression_levels
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#f5b544',
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS progression_levels_type_idx
  ON public.progression_levels (progression_type_id, level_number);

-- Add is_demo flag to progression_types too so seed data is identifiable
ALTER TABLE public.progression_types
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- Validation: xp values non-negative, level_number > 0
CREATE OR REPLACE FUNCTION public.validate_progression_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.level_number IS NULL OR NEW.level_number < 1 THEN
    RAISE EXCEPTION 'level_number must be >= 1';
  END IF;
  IF NEW.xp_required < 0 OR NEW.xp_from_previous < 0 THEN
    RAISE EXCEPTION 'XP values cannot be negative';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS progression_levels_validate ON public.progression_levels;
CREATE TRIGGER progression_levels_validate
  BEFORE INSERT OR UPDATE ON public.progression_levels
  FOR EACH ROW EXECUTE FUNCTION public.validate_progression_level();
