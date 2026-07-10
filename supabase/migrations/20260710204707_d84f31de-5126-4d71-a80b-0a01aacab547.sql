
-- =========================================================
-- PRESTIGE CONFIGS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.prestige_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  progression_type_id uuid REFERENCES public.progression_types(id) ON DELETE CASCADE,
  required_max_level integer NOT NULL DEFAULT 100,
  max_prestige_rank integer NOT NULL DEFAULT 10,
  prestige_name text NOT NULL DEFAULT 'Prestige',
  prestige_icon text,
  prestige_color text NOT NULL DEFAULT '#f5b301',
  xp_retention_pct numeric NOT NULL DEFAULT 0,
  reset_stats jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestige_configs TO authenticated;
GRANT ALL ON public.prestige_configs TO service_role;
ALTER TABLE public.prestige_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage prestige_configs" ON public.prestige_configs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone reads prestige_configs" ON public.prestige_configs
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_prestige_configs_updated BEFORE UPDATE ON public.prestige_configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- SEASONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'upcoming',  -- upcoming | active | ended | archived
  xp_modifier numeric NOT NULL DEFAULT 1.0,
  visible boolean NOT NULL DEFAULT true,
  progression_type_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  icon text,
  color text NOT NULL DEFAULT '#3fb950',
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage seasons" ON public.seasons
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Anyone reads seasons" ON public.seasons
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_seasons_updated BEFORE UPDATE ON public.seasons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- PLAYER PRESTIGE STATE + HISTORY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subject_prestige (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  progression_type_id uuid NOT NULL REFERENCES public.progression_types(id) ON DELETE CASCADE,
  prestige_config_id uuid REFERENCES public.prestige_configs(id) ON DELETE SET NULL,
  current_rank integer NOT NULL DEFAULT 0,
  total_prestiges integer NOT NULL DEFAULT 0,
  last_prestige_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, progression_type_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_prestige TO authenticated;
GRANT ALL ON public.subject_prestige TO service_role;
ALTER TABLE public.subject_prestige ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage subject_prestige" ON public.subject_prestige
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners read their prestige" ON public.subject_prestige
  FOR SELECT TO authenticated USING (subject_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_subject_prestige_updated BEFORE UPDATE ON public.subject_prestige
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.subject_prestige_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  progression_type_id uuid NOT NULL,
  prestige_config_id uuid,
  from_rank integer NOT NULL,
  to_rank integer NOT NULL,
  xp_before bigint NOT NULL DEFAULT 0,
  xp_retained bigint NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_prestige_history TO authenticated;
GRANT ALL ON public.subject_prestige_history TO service_role;
ALTER TABLE public.subject_prestige_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage prestige history" ON public.subject_prestige_history
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners read their prestige history" ON public.subject_prestige_history
  FOR SELECT TO authenticated USING (subject_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- PLAYER SEASON PROGRESS + HISTORY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subject_season_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  progression_type_id uuid NOT NULL REFERENCES public.progression_types(id) ON DELETE CASCADE,
  season_xp bigint NOT NULL DEFAULT 0,
  events_count integer NOT NULL DEFAULT 0,
  last_awarded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, season_id, progression_type_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_season_progress TO authenticated;
GRANT ALL ON public.subject_season_progress TO service_role;
ALTER TABLE public.subject_season_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage season progress" ON public.subject_season_progress
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners read their season progress" ON public.subject_season_progress
  FOR SELECT TO authenticated USING (subject_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_subject_season_progress_updated BEFORE UPDATE ON public.subject_season_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.subject_season_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  season_id uuid NOT NULL,
  progression_type_id uuid NOT NULL,
  final_xp bigint NOT NULL DEFAULT 0,
  events_count integer NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  archived_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_season_history TO authenticated;
GRANT ALL ON public.subject_season_history TO service_role;
ALTER TABLE public.subject_season_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage season history" ON public.subject_season_history
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners read their season history" ON public.subject_season_history
  FOR SELECT TO authenticated USING (subject_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- ENGINE HOOK: extend compute_effective_xp with season modifier
-- Keeps the single XP math path — Phase 7A remains the source of truth.
-- =========================================================
CREATE OR REPLACE FUNCTION public.compute_effective_xp(p_type_id uuid, p_source_id uuid, p_amount bigint, p_subject uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record; mult numeric := 1; result numeric;
  cu record; avg_lvl numeric; cur_lvl int; diff int; cu_mult numeric;
  s record;
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

  -- Active season modifiers
  FOR s IN
    SELECT * FROM public.seasons
    WHERE status = 'active'
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
      AND (array_length(progression_type_ids,1) IS NULL OR p_type_id = ANY(progression_type_ids))
  LOOP
    mult := mult * COALESCE(s.xp_modifier, 1);
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
END $function$;

-- =========================================================
-- PRESTIGE RPC
-- =========================================================
CREATE OR REPLACE FUNCTION public.prestige_advance(p_subject uuid, p_type_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cfg public.prestige_configs;
  sp public.subject_progression;
  cur public.subject_prestige;
  new_rank int;
  retained bigint;
  xp_before bigint;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> p_subject AND NOT public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO cfg FROM public.prestige_configs
    WHERE progression_type_id = p_type_id AND enabled = true AND status = 'active'
    ORDER BY sort_order ASC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','no_prestige_config'); END IF;

  SELECT * INTO sp FROM public.subject_progression
    WHERE subject_id = p_subject AND progression_type_id = p_type_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','no_progression'); END IF;
  IF sp.current_level < cfg.required_max_level THEN
    RETURN jsonb_build_object('error','below_required_level','required',cfg.required_max_level);
  END IF;

  SELECT * INTO cur FROM public.subject_prestige
    WHERE subject_id = p_subject AND progression_type_id = p_type_id FOR UPDATE;
  new_rank := COALESCE(cur.current_rank,0) + 1;
  IF new_rank > cfg.max_prestige_rank THEN RETURN jsonb_build_object('error','max_rank_reached'); END IF;

  xp_before := sp.current_xp;
  retained := floor(sp.current_xp::numeric * (cfg.xp_retention_pct/100.0))::bigint;

  UPDATE public.subject_progression SET
    current_xp = retained,
    current_level = public.progression_level_for_xp(p_type_id, retained),
    updated_at = now()
  WHERE id = sp.id;

  IF cur.id IS NULL THEN
    INSERT INTO public.subject_prestige (subject_id, progression_type_id, prestige_config_id, current_rank, total_prestiges, last_prestige_at)
      VALUES (p_subject, p_type_id, cfg.id, new_rank, 1, now());
  ELSE
    UPDATE public.subject_prestige SET
      current_rank = new_rank,
      total_prestiges = total_prestiges + 1,
      prestige_config_id = cfg.id,
      last_prestige_at = now(),
      updated_at = now()
    WHERE id = cur.id;
  END IF;

  INSERT INTO public.subject_prestige_history
    (subject_id, progression_type_id, prestige_config_id, from_rank, to_rank, xp_before, xp_retained)
  VALUES (p_subject, p_type_id, cfg.id, COALESCE(cur.current_rank,0), new_rank, xp_before, retained);

  RETURN jsonb_build_object('ok',true,'from_rank',COALESCE(cur.current_rank,0),'to_rank',new_rank,'xp_before',xp_before,'xp_retained',retained);
END $$;

-- =========================================================
-- SEASON TRACKING TRIGGER: mirror every XP award into active seasons
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_track_season_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s record;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN RETURN NEW; END IF;
  FOR s IN
    SELECT id FROM public.seasons
    WHERE status = 'active'
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
      AND (array_length(progression_type_ids,1) IS NULL OR NEW.progression_type_id = ANY(progression_type_ids))
  LOOP
    INSERT INTO public.subject_season_progress
      (subject_id, season_id, progression_type_id, season_xp, events_count, last_awarded_at)
    VALUES (NEW.subject_id, s.id, NEW.progression_type_id, NEW.amount, 1, now())
    ON CONFLICT (subject_id, season_id, progression_type_id) DO UPDATE
      SET season_xp = public.subject_season_progress.season_xp + EXCLUDED.season_xp,
          events_count = public.subject_season_progress.events_count + 1,
          last_awarded_at = now(),
          updated_at = now();
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_xp_award_track_seasons ON public.xp_award_log;
CREATE TRIGGER trg_xp_award_track_seasons
  AFTER INSERT ON public.xp_award_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_track_season_xp();

-- =========================================================
-- SEED DEMO DATA
-- =========================================================
DO $$
DECLARE
  player_type uuid;
  s1 uuid; s2 uuid; s3 uuid;
  demo_ids uuid[];
BEGIN
  SELECT id INTO player_type FROM public.progression_types
    WHERE category='player' OR slug='player' OR entity_type='player'
    ORDER BY (category='player') DESC, (slug='player') DESC, sort_order ASC LIMIT 1;

  -- Prestige configs
  INSERT INTO public.prestige_configs (slug, name, description, progression_type_id, required_max_level, max_prestige_rank, prestige_name, prestige_icon, prestige_color, xp_retention_pct, reset_stats, sort_order, is_demo)
  VALUES
    ('prestige-i','Prestige I','First tier of prestige, keeps 10% of XP.', player_type, 50, 3, 'Prestige I', 'crown', '#c0c0c0', 10, '["current_xp","current_level"]'::jsonb, 1, true),
    ('prestige-ii','Prestige II','Second prestige tier, keeps 20% of XP.', player_type, 75, 3, 'Prestige II', 'crown', '#f5b301', 20, '["current_xp","current_level"]'::jsonb, 2, true),
    ('prestige-iii','Prestige III','Elite prestige tier, keeps 35% of XP.', player_type, 100, 3, 'Prestige III', 'crown', '#a259ff', 35, '["current_xp","current_level"]'::jsonb, 3, true)
  ON CONFLICT (slug) DO NOTHING;

  -- Seasons
  INSERT INTO public.seasons (slug, name, description, starts_at, ends_at, status, xp_modifier, visible, progression_type_ids, color, sort_order, is_demo)
  VALUES
    ('season-1-founders','Season 1: Founder''s Era','Historic launch season for early founders.', now() - interval '120 days', now() - interval '60 days', 'ended', 1.0, true, CASE WHEN player_type IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[player_type] END, '#8b8b8b', 1, true),
    ('season-2-discovery','Season 2: Age of Discovery','Exploration-focused season with a boosted XP curve.', now() - interval '55 days', now() - interval '5 days', 'ended', 1.25, true, CASE WHEN player_type IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[player_type] END, '#3fb950', 2, true),
    ('season-3-expansion','Season 3: Realm Expansion','Current season, +50% XP across all activities.', now() - interval '3 days', now() + interval '60 days', 'active', 1.5, true, CASE WHEN player_type IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[player_type] END, '#f5b301', 3, true)
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO s1 FROM public.seasons WHERE slug='season-1-founders';
  SELECT id INTO s2 FROM public.seasons WHERE slug='season-2-discovery';
  SELECT id INTO s3 FROM public.seasons WHERE slug='season-3-expansion';

  -- Sample player prestige + season progress for existing demo subjects
  SELECT array_agg(id) INTO demo_ids FROM public.progression_demo_subjects LIMIT 6;

  IF demo_ids IS NOT NULL AND player_type IS NOT NULL THEN
    -- Prestige assignments
    INSERT INTO public.subject_prestige (subject_id, progression_type_id, prestige_config_id, current_rank, total_prestiges, last_prestige_at)
    SELECT
      demo_ids[i], player_type,
      (SELECT id FROM public.prestige_configs WHERE slug = CASE (i % 3) WHEN 0 THEN 'prestige-i' WHEN 1 THEN 'prestige-ii' ELSE 'prestige-iii' END),
      (i % 3) + 1, (i % 3) + 1, now() - (i || ' days')::interval
    FROM generate_series(1, LEAST(array_length(demo_ids,1),6)) i
    ON CONFLICT (subject_id, progression_type_id) DO NOTHING;

    -- Season XP progress
    INSERT INTO public.subject_season_progress (subject_id, season_id, progression_type_id, season_xp, events_count, last_awarded_at)
    SELECT demo_ids[i], s3, player_type, 500 + (i * 350), 5 + i, now() - (i || ' hours')::interval
    FROM generate_series(1, LEAST(array_length(demo_ids,1),6)) i
    ON CONFLICT (subject_id, season_id, progression_type_id) DO NOTHING;

    -- Season history for ended seasons
    INSERT INTO public.subject_season_history (subject_id, season_id, progression_type_id, final_xp, events_count, snapshot, archived_at)
    SELECT demo_ids[i], s2, player_type, 1200 + (i * 200), 12 + i, jsonb_build_object('rank', i), now() - interval '5 days'
    FROM generate_series(1, LEAST(array_length(demo_ids,1),6)) i;
  END IF;
END $$;
