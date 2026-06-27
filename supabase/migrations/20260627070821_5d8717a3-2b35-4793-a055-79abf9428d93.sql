
-- Games module tables
CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  status text NOT NULL DEFAULT 'active',
  include_tags uuid[] NOT NULL DEFAULT '{}',
  exclude_tags uuid[] NOT NULL DEFAULT '{}',
  enabled_modules text[] NOT NULL DEFAULT '{assets,collections,rewards,economy}',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
GRANT SELECT ON public.games TO anon;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games read all" ON public.games FOR SELECT USING (true);
CREATE POLICY "games admin write" ON public.games FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.mini_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mini_games TO authenticated;
GRANT ALL ON public.mini_games TO service_role;
GRANT SELECT ON public.mini_games TO anon;
ALTER TABLE public.mini_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mini_games read all" ON public.mini_games FOR SELECT USING (true);
CREATE POLICY "mini_games admin write" ON public.mini_games FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.realms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  image_url text,
  status text NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.realms TO authenticated;
GRANT ALL ON public.realms TO service_role;
GRANT SELECT ON public.realms TO anon;
ALTER TABLE public.realms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "realms read all" ON public.realms FOR SELECT USING (true);
CREATE POLICY "realms admin write" ON public.realms FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  realm_id uuid REFERENCES public.realms(id) ON DELETE SET NULL,
  lat numeric,
  lng numeric,
  status text NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
GRANT SELECT ON public.locations TO anon;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "locations read all" ON public.locations FOR SELECT USING (true);
CREATE POLICY "locations admin write" ON public.locations FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.feature_toggles (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_toggles TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.feature_toggles TO authenticated;
GRANT ALL ON public.feature_toggles TO service_role;
ALTER TABLE public.feature_toggles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_toggles read all" ON public.feature_toggles FOR SELECT USING (true);
CREATE POLICY "feature_toggles admin write" ON public.feature_toggles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Touch triggers
CREATE TRIGGER trg_games_touch BEFORE UPDATE ON public.games FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mini_games_touch BEFORE UPDATE ON public.mini_games FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_realms_touch BEFORE UPDATE ON public.realms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_locations_touch BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default feature toggles for core modules
INSERT INTO public.feature_toggles (key, enabled, description) VALUES
  ('module.assets', true, 'Assets module'),
  ('module.collections', true, 'Collections module'),
  ('module.rewards', true, 'Rewards module'),
  ('module.economy', true, 'Economy module'),
  ('module.games', true, 'Games module'),
  ('module.users', true, 'Users module'),
  ('module.automation', true, 'Automation module'),
  ('module.settings', true, 'Settings module')
ON CONFLICT (key) DO NOTHING;
