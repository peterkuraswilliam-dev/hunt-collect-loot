
-- Event type enum
DO $$ BEGIN
  CREATE TYPE public.xp_event_type AS ENUM ('xp_awarded','xp_removed','level_up','multi_level_up');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.xp_event_status AS ENUM ('processed','failed','replayed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Events table
CREATE TABLE IF NOT EXISTS public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL,
  progression_type_id uuid NOT NULL REFERENCES public.progression_types(id) ON DELETE CASCADE,
  xp_source_id uuid REFERENCES public.xp_sources(id) ON DELETE SET NULL,
  event_type public.xp_event_type NOT NULL,
  amount bigint NOT NULL DEFAULT 0,
  xp_before bigint NOT NULL DEFAULT 0,
  xp_after bigint NOT NULL DEFAULT 0,
  level_before int NOT NULL DEFAULT 1,
  level_after int NOT NULL DEFAULT 1,
  levels_gained int NOT NULL DEFAULT 0,
  status public.xp_event_status NOT NULL DEFAULT 'processed',
  error_message text,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  replay_of uuid REFERENCES public.xp_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage xp_events" ON public.xp_events;
CREATE POLICY "Admins manage xp_events" ON public.xp_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users read own xp_events" ON public.xp_events;
CREATE POLICY "Users read own xp_events" ON public.xp_events
  FOR SELECT TO authenticated
  USING (subject_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_xp_events_created_at ON public.xp_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_subject ON public.xp_events(subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_type ON public.xp_events(progression_type_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_event_type ON public.xp_events(event_type);

-- Submit event: single entrypoint for future modules
CREATE OR REPLACE FUNCTION public.submit_xp_event(
  p_subject uuid,
  p_type_id uuid,
  p_source_id uuid,
  p_amount bigint,
  p_note text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.progression_types;
  v_source public.xp_sources;
  v_result jsonb;
  v_event_type public.xp_event_type;
  v_event_id uuid;
BEGIN
  -- Validate progression type
  SELECT * INTO v_type FROM public.progression_types WHERE id = p_type_id;
  IF NOT FOUND THEN
    INSERT INTO public.xp_events (subject_id, progression_type_id, xp_source_id, event_type, amount, status, error_message, note, metadata)
    VALUES (p_subject, p_type_id, p_source_id, 'xp_awarded', COALESCE(p_amount,0), 'failed', 'progression_type_not_found', p_note, COALESCE(p_metadata,'{}'::jsonb))
    RETURNING id INTO v_event_id;
    RETURN jsonb_build_object('ok', false, 'error', 'progression_type_not_found', 'event_id', v_event_id);
  END IF;

  -- Validate source (optional)
  IF p_source_id IS NOT NULL THEN
    SELECT * INTO v_source FROM public.xp_sources WHERE id = p_source_id;
    IF NOT FOUND THEN
      INSERT INTO public.xp_events (subject_id, progression_type_id, xp_source_id, event_type, amount, status, error_message, note, metadata)
      VALUES (p_subject, p_type_id, NULL, 'xp_awarded', COALESCE(p_amount,0), 'failed', 'xp_source_not_found', p_note, COALESCE(p_metadata,'{}'::jsonb))
      RETURNING id INTO v_event_id;
      RETURN jsonb_build_object('ok', false, 'error', 'xp_source_not_found', 'event_id', v_event_id);
    END IF;
  END IF;

  -- Validate amount
  IF p_amount IS NULL OR p_amount = 0 THEN
    INSERT INTO public.xp_events (subject_id, progression_type_id, xp_source_id, event_type, amount, status, error_message, note, metadata)
    VALUES (p_subject, p_type_id, p_source_id, 'xp_awarded', 0, 'failed', 'invalid_amount', p_note, COALESCE(p_metadata,'{}'::jsonb))
    RETURNING id INTO v_event_id;
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount', 'event_id', v_event_id);
  END IF;

  -- Process via XP engine
  v_result := public.award_xp(p_subject, p_type_id, p_source_id, p_amount, p_note);

  -- Determine event type
  IF (v_result->>'leveled_up')::boolean THEN
    IF (v_result->>'levels_gained')::int > 1 THEN
      v_event_type := 'multi_level_up';
    ELSE
      v_event_type := 'level_up';
    END IF;
  ELSIF p_amount < 0 THEN
    v_event_type := 'xp_removed';
  ELSE
    v_event_type := 'xp_awarded';
  END IF;

  INSERT INTO public.xp_events (
    subject_id, progression_type_id, xp_source_id, event_type, amount,
    xp_before, xp_after, level_before, level_after, levels_gained,
    status, note, metadata
  ) VALUES (
    p_subject, p_type_id, p_source_id, v_event_type, p_amount,
    (v_result->>'xp_before')::bigint,
    (v_result->>'xp_after')::bigint,
    (v_result->>'level_before')::int,
    (v_result->>'level_after')::int,
    (v_result->>'levels_gained')::int,
    'processed', p_note, COALESCE(p_metadata,'{}'::jsonb)
  ) RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('ok', true, 'event_id', v_event_id, 'result', v_result, 'event_type', v_event_type);
END $$;

GRANT EXECUTE ON FUNCTION public.submit_xp_event(uuid,uuid,uuid,bigint,text,jsonb) TO authenticated, service_role;

-- Replay (admin only)
CREATE OR REPLACE FUNCTION public.replay_xp_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evt public.xp_events;
  v_result jsonb;
  v_new_event_id uuid;
  v_event_type public.xp_event_type;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_evt FROM public.xp_events WHERE id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found'; END IF;

  v_result := public.award_xp(v_evt.subject_id, v_evt.progression_type_id, v_evt.xp_source_id, v_evt.amount, COALESCE(v_evt.note,'') || ' [replay]');

  IF (v_result->>'leveled_up')::boolean THEN
    v_event_type := CASE WHEN (v_result->>'levels_gained')::int > 1 THEN 'multi_level_up'::public.xp_event_type ELSE 'level_up'::public.xp_event_type END;
  ELSIF v_evt.amount < 0 THEN
    v_event_type := 'xp_removed';
  ELSE
    v_event_type := 'xp_awarded';
  END IF;

  INSERT INTO public.xp_events (
    subject_id, progression_type_id, xp_source_id, event_type, amount,
    xp_before, xp_after, level_before, level_after, levels_gained,
    status, note, metadata, replay_of
  ) VALUES (
    v_evt.subject_id, v_evt.progression_type_id, v_evt.xp_source_id, v_event_type, v_evt.amount,
    (v_result->>'xp_before')::bigint,
    (v_result->>'xp_after')::bigint,
    (v_result->>'level_before')::int,
    (v_result->>'level_after')::int,
    (v_result->>'levels_gained')::int,
    'replayed', v_evt.note, v_evt.metadata, v_evt.id
  ) RETURNING id INTO v_new_event_id;

  RETURN jsonb_build_object('ok', true, 'event_id', v_new_event_id, 'result', v_result);
END $$;

GRANT EXECUTE ON FUNCTION public.replay_xp_event(uuid) TO authenticated, service_role;
