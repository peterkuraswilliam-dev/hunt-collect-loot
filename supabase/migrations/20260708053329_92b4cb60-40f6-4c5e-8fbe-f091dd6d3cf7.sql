
ALTER TABLE public.subject_progression
  ADD COLUMN IF NOT EXISTS lifetime_xp bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_awarded_amount bigint,
  ADD COLUMN IF NOT EXISTS last_awarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_level_up_at timestamptz;

-- Allow reading the XP history log widely (admin CMS displays it)
DROP POLICY IF EXISTS "Admins view xp log" ON public.xp_award_log;
CREATE POLICY "Anyone can view xp log" ON public.xp_award_log FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_xp_award_log_created_at ON public.xp_award_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_award_log_leveled_up ON public.xp_award_log (leveled_up, created_at DESC) WHERE leveled_up = true;

CREATE OR REPLACE FUNCTION public.award_xp(
  p_subject uuid, p_type_id uuid, p_source_id uuid, p_amount bigint, p_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t public.progression_types;
  cur public.subject_progression;
  xp_before bigint;
  xp_after bigint;
  level_before int;
  level_after int;
  max_xp bigint;
  applied_delta bigint;
BEGIN
  SELECT * INTO t FROM public.progression_types WHERE id = p_type_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'progression_type_not_found'; END IF;

  SELECT * INTO cur FROM public.subject_progression
    WHERE subject_id = p_subject AND progression_type_id = p_type_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.subject_progression (subject_id, progression_type_id, current_xp, current_level, lifetime_xp)
      VALUES (p_subject, p_type_id, t.starting_xp, t.starting_level, GREATEST(t.starting_xp, 0))
      RETURNING * INTO cur;
  END IF;

  xp_before := cur.current_xp;
  level_before := cur.current_level;
  xp_after := xp_before + p_amount;
  IF xp_after < 0 THEN xp_after := 0; END IF;

  SELECT xp_required INTO max_xp FROM public.progression_levels
    WHERE progression_type_id = p_type_id AND level_number = t.max_level LIMIT 1;
  IF max_xp IS NOT NULL AND NOT t.allow_overflow_xp AND xp_after > max_xp THEN
    xp_after := max_xp;
  END IF;

  level_after := public.progression_level_for_xp(p_type_id, xp_after);
  applied_delta := xp_after - xp_before;

  UPDATE public.subject_progression SET
    current_xp = xp_after,
    current_level = level_after,
    lifetime_xp = lifetime_xp + GREATEST(applied_delta, 0),
    last_awarded_amount = p_amount,
    last_awarded_at = now(),
    last_level_up_at = CASE WHEN level_after > level_before THEN now() ELSE last_level_up_at END,
    updated_at = now()
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
END $function$;

-- Backfill lifetime_xp for existing rows using current_xp as best guess
UPDATE public.subject_progression SET lifetime_xp = GREATEST(lifetime_xp, current_xp) WHERE lifetime_xp < current_xp;
