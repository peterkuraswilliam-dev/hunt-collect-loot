
-- Demo subjects (players/assets/etc) for XP engine testing
CREATE TABLE public.progression_demo_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'player',
  avatar text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progression_demo_subjects TO authenticated;
GRANT SELECT ON public.progression_demo_subjects TO anon;
GRANT ALL ON public.progression_demo_subjects TO service_role;
ALTER TABLE public.progression_demo_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view demo subjects" ON public.progression_demo_subjects FOR SELECT USING (true);
CREATE POLICY "Admins manage demo subjects" ON public.progression_demo_subjects FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Progression state per subject per progression type
CREATE TABLE public.subject_progression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  progression_type_id uuid NOT NULL REFERENCES public.progression_types(id) ON DELETE CASCADE,
  current_xp bigint NOT NULL DEFAULT 0,
  current_level integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, progression_type_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_progression TO authenticated;
GRANT SELECT ON public.subject_progression TO anon;
GRANT ALL ON public.subject_progression TO service_role;
ALTER TABLE public.subject_progression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view subject progression" ON public.subject_progression FOR SELECT USING (true);
CREATE POLICY "Admins manage subject progression" ON public.subject_progression FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- XP award / remove ledger
CREATE TABLE public.xp_award_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  progression_type_id uuid NOT NULL REFERENCES public.progression_types(id) ON DELETE CASCADE,
  xp_source_id uuid REFERENCES public.xp_sources(id) ON DELETE SET NULL,
  amount bigint NOT NULL,
  xp_before bigint NOT NULL,
  xp_after bigint NOT NULL,
  level_before integer NOT NULL,
  level_after integer NOT NULL,
  leveled_up boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.xp_award_log TO authenticated;
GRANT ALL ON public.xp_award_log TO service_role;
ALTER TABLE public.xp_award_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view xp log" ON public.xp_award_log FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert xp log" ON public.xp_award_log FOR INSERT WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_xp_award_log_subject ON public.xp_award_log(subject_id, progression_type_id, created_at DESC);
CREATE INDEX idx_subject_progression_subject ON public.subject_progression(subject_id);

-- Core engine: compute level from cumulative XP against configured levels
CREATE OR REPLACE FUNCTION public.progression_level_for_xp(p_type_id uuid, p_xp bigint)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  starting_lvl int;
  lvl int;
BEGIN
  SELECT starting_level INTO starting_lvl FROM public.progression_types WHERE id = p_type_id;
  IF starting_lvl IS NULL THEN starting_lvl := 1; END IF;
  SELECT COALESCE(MAX(level_number), starting_lvl) INTO lvl
    FROM public.progression_levels
    WHERE progression_type_id = p_type_id AND xp_required <= p_xp;
  RETURN GREATEST(lvl, starting_lvl);
END $$;

-- Core engine: XP required to reach the next level (from configured levels)
CREATE OR REPLACE FUNCTION public.progression_next_level_xp(p_type_id uuid, p_current_level integer)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT xp_required FROM public.progression_levels
   WHERE progression_type_id = p_type_id AND level_number = p_current_level + 1
   LIMIT 1
$$;

-- Award or remove XP (single source of truth)
CREATE OR REPLACE FUNCTION public.award_xp(
  p_subject uuid,
  p_type_id uuid,
  p_source_id uuid,
  p_amount bigint,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  t public.progression_types;
  cur public.subject_progression;
  xp_before bigint;
  xp_after bigint;
  level_before int;
  level_after int;
  max_xp bigint;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO t FROM public.progression_types WHERE id = p_type_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'progression_type_not_found'; END IF;

  SELECT * INTO cur FROM public.subject_progression
    WHERE subject_id = p_subject AND progression_type_id = p_type_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.subject_progression (subject_id, progression_type_id, current_xp, current_level)
      VALUES (p_subject, p_type_id, t.starting_xp, t.starting_level)
      RETURNING * INTO cur;
  END IF;

  xp_before := cur.current_xp;
  level_before := cur.current_level;
  xp_after := xp_before + p_amount;
  IF xp_after < 0 THEN xp_after := 0; END IF;

  -- Respect max_level XP cap unless overflow allowed
  SELECT xp_required INTO max_xp FROM public.progression_levels
   WHERE progression_type_id = p_type_id AND level_number = t.max_level LIMIT 1;
  IF max_xp IS NOT NULL AND NOT t.allow_overflow_xp AND xp_after > max_xp THEN
    xp_after := max_xp;
  END IF;

  level_after := public.progression_level_for_xp(p_type_id, xp_after);

  UPDATE public.subject_progression
     SET current_xp = xp_after, current_level = level_after, updated_at = now()
   WHERE id = cur.id;

  INSERT INTO public.xp_award_log
    (subject_id, progression_type_id, xp_source_id, amount, xp_before, xp_after, level_before, level_after, leveled_up, note)
  VALUES
    (p_subject, p_type_id, p_source_id, p_amount, xp_before, xp_after, level_before, level_after, level_after > level_before, p_note);

  RETURN jsonb_build_object(
    'subject_id', p_subject,
    'progression_type_id', p_type_id,
    'xp_before', xp_before,
    'xp_after', xp_after,
    'level_before', level_before,
    'level_after', level_after,
    'leveled_up', level_after > level_before,
    'levels_gained', GREATEST(level_after - level_before, 0),
    'next_level_xp', public.progression_next_level_xp(p_type_id, level_after)
  );
END $$;

-- Seed 10 demo players
INSERT INTO public.progression_demo_subjects (name, kind, notes) VALUES
  ('Aria Novice', 'player', 'Fresh start'),
  ('Brix Rookie', 'player', 'Low level'),
  ('Ceres Explorer', 'player', 'Mid-early'),
  ('Dax Adept', 'player', 'Mid game'),
  ('Elara Veteran', 'player', 'Experienced'),
  ('Fen Master', 'player', 'High level'),
  ('Gale Champion', 'player', 'Near cap'),
  ('Hesper Prime', 'player', 'Capped'),
  ('Iris Prestige', 'player', 'Overflow tester'),
  ('Jax Sandbox', 'player', 'Blank slate');
