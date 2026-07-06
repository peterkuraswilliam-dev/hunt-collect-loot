
-- 1. Extend xp_sources
ALTER TABLE public.xp_sources
  ADD COLUMN IF NOT EXISTS progression_type_id uuid REFERENCES public.progression_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#f5b544',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS max_xp_per_action integer,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS xp_sources_progression_type_idx ON public.xp_sources(progression_type_id);
CREATE INDEX IF NOT EXISTS xp_sources_category_idx ON public.xp_sources(category);
CREATE INDEX IF NOT EXISTS xp_sources_status_idx ON public.xp_sources(status);

-- 2. Validation trigger
CREATE OR REPLACE FUNCTION public.validate_xp_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.base_xp < 0 THEN RAISE EXCEPTION 'base_xp cannot be negative'; END IF;
  IF NEW.daily_cap IS NOT NULL AND NEW.daily_cap < 0 THEN RAISE EXCEPTION 'daily_cap cannot be negative'; END IF;
  IF NEW.weekly_cap IS NOT NULL AND NEW.weekly_cap < 0 THEN RAISE EXCEPTION 'weekly_cap cannot be negative'; END IF;
  IF NEW.cooldown_seconds < 0 THEN RAISE EXCEPTION 'cooldown_seconds cannot be negative'; END IF;
  IF NEW.min_level < 1 THEN RAISE EXCEPTION 'min_level must be >= 1'; END IF;
  IF NEW.max_level IS NOT NULL AND NEW.max_level < NEW.min_level THEN
    RAISE EXCEPTION 'max_level must be >= min_level';
  END IF;
  IF NEW.max_xp_per_action IS NOT NULL AND NEW.max_xp_per_action < 0 THEN
    RAISE EXCEPTION 'max_xp_per_action cannot be negative';
  END IF;
  IF NEW.daily_cap IS NOT NULL AND NEW.weekly_cap IS NOT NULL AND NEW.weekly_cap < NEW.daily_cap THEN
    RAISE EXCEPTION 'weekly_cap must be >= daily_cap';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS xp_sources_validate ON public.xp_sources;
CREATE TRIGGER xp_sources_validate BEFORE INSERT OR UPDATE ON public.xp_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_xp_source();

-- 3. Custom categories table
CREATE TABLE IF NOT EXISTS public.xp_source_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#f5b544',
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_source_categories TO authenticated;
GRANT ALL ON public.xp_source_categories TO service_role;

ALTER TABLE public.xp_source_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xp_source_categories read" ON public.xp_source_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "xp_source_categories admin write" ON public.xp_source_categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS xp_source_categories_touch ON public.xp_source_categories;
CREATE TRIGGER xp_source_categories_touch BEFORE UPDATE ON public.xp_source_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Seed default categories
INSERT INTO public.xp_source_categories (slug, label, color, icon, sort_order) VALUES
  ('combat','Combat','#ef4444','⚔️',10),
  ('bosses','Bosses','#dc2626','👹',20),
  ('quests','Quests','#8b5cf6','📜',30),
  ('daily','Daily Activities','#3b82f6','📅',40),
  ('weekly','Weekly Activities','#2563eb','🗓️',50),
  ('exploration','Exploration','#10b981','🧭',60),
  ('discovery','Discovery','#14b8a6','🔍',70),
  ('crafting','Crafting','#f59e0b','🔨',80),
  ('gathering','Gathering','#84cc16','🌿',90),
  ('fishing','Fishing','#06b6d4','🎣',100),
  ('mining','Mining','#78716c','⛏️',110),
  ('trading','Trading','#eab308','💰',120),
  ('mini_games','Mini Games','#ec4899','🎮',130),
  ('professions','Professions','#f97316','🛠️',140),
  ('assets','Assets','#a855f7','🎴',150),
  ('guild','Guild','#0ea5e9','🛡️',160),
  ('reputation','Reputation','#f5b544','🏅',170),
  ('seasonal','Seasonal Events','#e11d48','❄️',180),
  ('community','Community Events','#22c55e','🎉',190)
ON CONFLICT (slug) DO NOTHING;
