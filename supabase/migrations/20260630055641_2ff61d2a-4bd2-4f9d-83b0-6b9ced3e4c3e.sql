
-- Progression Types
CREATE TABLE public.progression_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  status text NOT NULL DEFAULT 'active',
  max_level int NOT NULL DEFAULT 100,
  default_curve_id uuid,
  xp_display_name text NOT NULL DEFAULT 'XP',
  visible boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.progression_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.progression_types TO authenticated;
GRANT ALL ON public.progression_types TO service_role;
ALTER TABLE public.progression_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progression_types read" ON public.progression_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "progression_types admin write" ON public.progression_types FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- XP Curves
CREATE TABLE public.xp_curves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  growth_type text NOT NULL DEFAULT 'linear',
  base_xp int NOT NULL DEFAULT 100,
  growth_multiplier numeric NOT NULL DEFAULT 1.0,
  max_level int NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'active',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_curves TO authenticated;
GRANT ALL ON public.xp_curves TO service_role;
ALTER TABLE public.xp_curves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_curves read" ON public.xp_curves FOR SELECT TO authenticated USING (true);
CREATE POLICY "xp_curves admin write" ON public.xp_curves FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.progression_types
  ADD CONSTRAINT progression_types_default_curve_fk
  FOREIGN KEY (default_curve_id) REFERENCES public.xp_curves(id) ON DELETE SET NULL;

-- Progression Levels
CREATE TABLE public.progression_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progression_type_id uuid REFERENCES public.progression_types(id) ON DELETE CASCADE,
  level_number int NOT NULL,
  xp_required bigint NOT NULL DEFAULT 0,
  xp_from_previous bigint NOT NULL DEFAULT 0,
  title text,
  icon text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (progression_type_id, level_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progression_levels TO authenticated;
GRANT ALL ON public.progression_levels TO service_role;
ALTER TABLE public.progression_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progression_levels read" ON public.progression_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "progression_levels admin write" ON public.progression_levels FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- XP Sources
CREATE TABLE public.xp_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  enabled boolean NOT NULL DEFAULT true,
  base_xp int NOT NULL DEFAULT 0,
  scaling_enabled boolean NOT NULL DEFAULT false,
  daily_cap int,
  weekly_cap int,
  cooldown_seconds int NOT NULL DEFAULT 0,
  min_level int NOT NULL DEFAULT 1,
  max_level int,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_sources TO authenticated;
GRANT ALL ON public.xp_sources TO service_role;
ALTER TABLE public.xp_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_sources read" ON public.xp_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "xp_sources admin write" ON public.xp_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- XP Multipliers
CREATE TABLE public.xp_multipliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'global',
  value numeric NOT NULL DEFAULT 1.0,
  priority int NOT NULL DEFAULT 0,
  stackable boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xp_multipliers TO authenticated;
GRANT ALL ON public.xp_multipliers TO service_role;
ALTER TABLE public.xp_multipliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_multipliers read" ON public.xp_multipliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "xp_multipliers admin write" ON public.xp_multipliers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- updated_at triggers
CREATE TRIGGER progression_types_touch BEFORE UPDATE ON public.progression_types FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER xp_curves_touch BEFORE UPDATE ON public.xp_curves FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER progression_levels_touch BEFORE UPDATE ON public.progression_levels FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER xp_sources_touch BEFORE UPDATE ON public.xp_sources FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER xp_multipliers_touch BEFORE UPDATE ON public.xp_multipliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
