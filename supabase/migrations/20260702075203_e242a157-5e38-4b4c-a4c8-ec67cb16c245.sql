
-- 1. Entity types lookup
CREATE TABLE IF NOT EXISTS public.progression_entity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.progression_entity_types TO authenticated;
GRANT ALL ON public.progression_entity_types TO service_role;

ALTER TABLE public.progression_entity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entity_types read" ON public.progression_entity_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "entity_types admin write" ON public.progression_entity_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER progression_entity_types_touch
  BEFORE UPDATE ON public.progression_entity_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.progression_entity_types (slug, label, sort_order) VALUES
  ('player', 'Player', 1),
  ('asset', 'Asset', 2),
  ('profession', 'Profession', 3),
  ('companion', 'Companion', 4),
  ('guild', 'Guild', 5),
  ('reputation', 'Reputation', 6),
  ('realm', 'Realm', 7),
  ('seasonal', 'Seasonal', 8),
  ('other', 'Other', 99)
ON CONFLICT (slug) DO NOTHING;

-- 2. Extend progression_types
ALTER TABLE public.progression_types
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#f5b544',
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'player',
  ADD COLUMN IF NOT EXISTS starting_level int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS starting_xp int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allow_overflow_xp boolean NOT NULL DEFAULT false;

-- 3. Validation trigger
CREATE OR REPLACE FUNCTION public.validate_progression_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.max_level IS NULL OR NEW.max_level <= 0 THEN
    RAISE EXCEPTION 'max_level must be greater than zero';
  END IF;
  IF NEW.starting_level < 1 OR NEW.starting_level > NEW.max_level THEN
    RAISE EXCEPTION 'starting_level must be between 1 and max_level';
  END IF;
  IF NEW.starting_xp < 0 THEN
    RAISE EXCEPTION 'starting_xp cannot be negative';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS progression_types_validate ON public.progression_types;
CREATE TRIGGER progression_types_validate
  BEFORE INSERT OR UPDATE ON public.progression_types
  FOR EACH ROW EXECUTE FUNCTION public.validate_progression_type();
