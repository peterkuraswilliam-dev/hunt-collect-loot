
-- Rested XP configs
CREATE TABLE public.rested_xp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  progression_type_id uuid REFERENCES public.progression_types(id) ON DELETE SET NULL,
  regen_rate_per_hour numeric NOT NULL DEFAULT 100,
  max_storage bigint NOT NULL DEFAULT 10000,
  bonus_multiplier numeric NOT NULL DEFAULT 2.0,
  offline_accumulation boolean NOT NULL DEFAULT true,
  expires_after_hours integer,
  priority integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rested_xp_configs TO authenticated;
GRANT ALL ON public.rested_xp_configs TO service_role;
ALTER TABLE public.rested_xp_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rested configs" ON public.rested_xp_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage rested configs" ON public.rested_xp_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_rested_configs_touch BEFORE UPDATE ON public.rested_xp_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Catch-up XP configs
CREATE TABLE public.catchup_xp_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  progression_type_id uuid REFERENCES public.progression_types(id) ON DELETE SET NULL,
  min_level_difference integer NOT NULL DEFAULT 5,
  multiplier numeric NOT NULL DEFAULT 1.5,
  max_bonus numeric NOT NULL DEFAULT 3.0,
  reference text NOT NULL DEFAULT 'average_level',
  priority integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catchup_xp_configs TO authenticated;
GRANT ALL ON public.catchup_xp_configs TO service_role;
ALTER TABLE public.catchup_xp_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read catchup configs" ON public.catchup_xp_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage catchup configs" ON public.catchup_xp_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_catchup_configs_touch BEFORE UPDATE ON public.catchup_xp_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Per-subject rested pool
CREATE TABLE public.subject_rested_xp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  progression_type_id uuid NOT NULL REFERENCES public.progression_types(id) ON DELETE CASCADE,
  stored_xp bigint NOT NULL DEFAULT 0,
  last_accrued_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, progression_type_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_rested_xp TO authenticated;
GRANT ALL ON public.subject_rested_xp TO service_role;
ALTER TABLE public.subject_rested_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rested pools" ON public.subject_rested_xp FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage rested pools" ON public.subject_rested_xp FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_subject_rested_touch BEFORE UPDATE ON public.subject_rested_xp
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Extend compute_effective_xp to include catch-up
CREATE OR REPLACE FUNCTION public.compute_effective_xp(p_type_id uuid, p_source_id uuid, p_amount bigint, p_subject uuid DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; mult numeric := 1; result numeric;
  cu record; avg_lvl numeric; cur_lvl int; diff int; cu_mult numeric;
BEGIN
  FOR r IN
    SELECT * FROM public.progression_rules
    WHERE enabled = true AND status = 'active'
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
    ORDER BY priority ASC
  LOOP
    IF r.rule_type = 'global_multiplier' THEN mult := mult * r.value;
    ELSIF r.rule_type = 'type_multiplier' AND r.progression_type_id = p_type_id THEN mult := mult * r.value;
    ELSIF r.rule_type = 'source_multiplier' AND r.xp_source_id = p_source_id THEN mult := mult * r.value;
    END IF;
  END LOOP;

  -- catch-up
  IF p_subject IS NOT NULL THEN
    SELECT current_level INTO cur_lvl FROM public.subject_progression
      WHERE subject_id = p_subject AND progression_type_id = p_type_id;
    IF cur_lvl IS NOT NULL THEN
      SELECT AVG(current_level) INTO avg_lvl FROM public.subject_progression
        WHERE progression_type_id = p_type_id;
      FOR cu IN
        SELECT * FROM public.catchup_xp_configs
        WHERE enabled = true AND status = 'active'
          AND (progression_type_id IS NULL OR progression_type_id = p_type_id)
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at >= now())
        ORDER BY priority ASC
      LOOP
        diff := floor(COALESCE(avg_lvl,0))::int - cur_lvl;
        IF diff >= cu.min_level_difference THEN
          cu_mult := LEAST(cu.multiplier, cu.max_bonus);
          mult := mult * cu_mult;
        END IF;
      END LOOP;
    END IF;
  END IF;

  result := p_amount::numeric * mult;
  RETURN floor(result)::bigint;
END $$;

-- Seed configs
INSERT INTO public.rested_xp_configs (name, description, regen_rate_per_hour, max_storage, bonus_multiplier, offline_accumulation, expires_after_hours, notes)
VALUES ('Standard Rested XP', 'Default rested XP that regenerates while offline and grants a 2x bonus when spent.', 100, 10000, 2.0, true, 168, 'Demo configuration');

INSERT INTO public.catchup_xp_configs (name, description, min_level_difference, multiplier, max_bonus, notes)
VALUES
  ('New Player Catch-Up', 'Boosts XP for players significantly behind the average level.', 5, 1.5, 3.0, 'Demo configuration'),
  ('Weekend Catch-Up Event', 'Weekend event increasing catch-up bonus for players 3+ levels behind.', 3, 2.0, 4.0, 'Demo event');

-- Seed rested pools for existing demo subjects on Player progression type
INSERT INTO public.subject_rested_xp (subject_id, progression_type_id, stored_xp, last_accrued_at)
SELECT s.id, pt.id, (500 + floor(random()*4500))::bigint, now() - (floor(random()*72) || ' hours')::interval
FROM public.progression_demo_subjects s
CROSS JOIN LATERAL (
  SELECT id FROM public.progression_types WHERE slug = 'player-level' LIMIT 1
) pt
ON CONFLICT (subject_id, progression_type_id) DO NOTHING;
