
-- ============ Enums ============
DO $$ BEGIN
  CREATE TYPE public.reward_distribution_status AS ENUM ('pending','processing','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reward_distribution_type AS ENUM ('direct','bundle','loot_table');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ Requests table ============
CREATE TABLE IF NOT EXISTS public.reward_distribution_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_module text NOT NULL,
  source_record_id text,
  source_record_name text,
  player_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request_type public.reward_distribution_type NOT NULL,
  reward_id uuid REFERENCES public.rewards(id) ON DELETE SET NULL,
  reward_bundle_id uuid REFERENCES public.reward_bundles(id) ON DELETE SET NULL,
  loot_table_id uuid REFERENCES public.loot_tables(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  status public.reward_distribution_status NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 0,
  conditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_rewards jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_distribution_requests TO authenticated;
GRANT ALL ON public.reward_distribution_requests TO service_role;

ALTER TABLE public.reward_distribution_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage all distribution requests"
  ON public.reward_distribution_requests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "players view own distribution requests"
  ON public.reward_distribution_requests FOR SELECT
  TO authenticated
  USING (player_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_rdr_status ON public.reward_distribution_requests(status);
CREATE INDEX IF NOT EXISTS idx_rdr_source ON public.reward_distribution_requests(source_module);
CREATE INDEX IF NOT EXISTS idx_rdr_player ON public.reward_distribution_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_rdr_created ON public.reward_distribution_requests(created_at DESC);

CREATE TRIGGER trg_rdr_touch
  BEFORE UPDATE ON public.reward_distribution_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Activity table ============
CREATE TABLE IF NOT EXISTS public.reward_distribution_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.reward_distribution_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.reward_distribution_activity TO authenticated;
GRANT ALL ON public.reward_distribution_activity TO service_role;

ALTER TABLE public.reward_distribution_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view all distribution activity"
  ON public.reward_distribution_activity FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "admins insert distribution activity"
  ON public.reward_distribution_activity FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_rda_request ON public.reward_distribution_activity(request_id, created_at DESC);

-- ============ Processing function ============
CREATE OR REPLACE FUNCTION public.process_reward_distribution_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.reward_distribution_requests;
  resolved jsonb := '[]'::jsonb;
  r record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO req FROM public.reward_distribution_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF req.status NOT IN ('pending','failed') THEN
    RETURN jsonb_build_object('error','invalid_state','status',req.status);
  END IF;

  UPDATE public.reward_distribution_requests SET status='processing', error_message=NULL WHERE id=p_request_id;
  INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
    VALUES (p_request_id,'processing_started',auth.uid(),'{}'::jsonb);

  BEGIN
    -- Validate source
    IF req.source_module IS NULL OR length(req.source_module)=0 THEN
      RAISE EXCEPTION 'missing_source_module';
    END IF;

    -- Resolve rewards based on request type
    IF req.request_type = 'direct' THEN
      IF req.reward_id IS NULL THEN RAISE EXCEPTION 'missing_reward'; END IF;
      SELECT jsonb_build_array(jsonb_build_object(
        'reward_id', id, 'name', name, 'quantity', GREATEST(req.quantity,1), 'source','direct'
      )) INTO resolved FROM public.rewards WHERE id = req.reward_id;
      IF resolved IS NULL THEN RAISE EXCEPTION 'reward_not_found'; END IF;

    ELSIF req.request_type = 'bundle' THEN
      IF req.reward_bundle_id IS NULL THEN RAISE EXCEPTION 'missing_bundle'; END IF;
      PERFORM 1 FROM public.reward_bundles WHERE id = req.reward_bundle_id AND enabled = true;
      IF NOT FOUND THEN RAISE EXCEPTION 'bundle_unavailable'; END IF;
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'reward_id', rw.id, 'name', rw.name,
        'quantity', COALESCE(bi.quantity_override, rw.quantity, 1),
        'guaranteed', bi.guaranteed, 'source','bundle'
      ) ORDER BY bi.display_order), '[]'::jsonb) INTO resolved
        FROM public.reward_bundle_items bi
        JOIN public.rewards rw ON rw.id = bi.reward_id
        WHERE bi.bundle_id = req.reward_bundle_id;

    ELSIF req.request_type = 'loot_table' THEN
      IF req.loot_table_id IS NULL THEN RAISE EXCEPTION 'missing_loot_table'; END IF;
      PERFORM 1 FROM public.loot_tables WHERE id = req.loot_table_id AND enabled = true;
      IF NOT FOUND THEN RAISE EXCEPTION 'loot_table_unavailable'; END IF;
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'reward_id', rw.id, 'name', rw.name,
        'weight', e.weight, 'drop_chance', e.drop_chance,
        'min_quantity', e.min_quantity, 'max_quantity', e.max_quantity,
        'guaranteed', e.guaranteed, 'source','loot_table'
      ) ORDER BY e.display_order), '[]'::jsonb) INTO resolved
        FROM public.loot_table_entries e
        JOIN public.rewards rw ON rw.id = e.reward_id
        WHERE e.loot_table_id = req.loot_table_id AND e.enabled = true;
    END IF;

    UPDATE public.reward_distribution_requests SET
      status='completed', resolved_rewards = COALESCE(resolved,'[]'::jsonb), processed_at=now()
    WHERE id = p_request_id;

    INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
      VALUES (p_request_id,'completed',auth.uid(),jsonb_build_object('count',jsonb_array_length(COALESCE(resolved,'[]'::jsonb))));

    RETURN jsonb_build_object('ok',true,'resolved',resolved);
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.reward_distribution_requests SET status='failed', error_message=SQLERRM, processed_at=now() WHERE id=p_request_id;
    INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
      VALUES (p_request_id,'failed',auth.uid(),jsonb_build_object('error',SQLERRM));
    RETURN jsonb_build_object('ok',false,'error',SQLERRM);
  END;
END $$;

-- ============ Cancel function ============
CREATE OR REPLACE FUNCTION public.cancel_reward_distribution_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.reward_distribution_requests
    SET status='cancelled', processed_at=now()
    WHERE id = p_request_id AND status IN ('pending','failed');
  INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
    VALUES (p_request_id,'cancelled',auth.uid(),'{}'::jsonb);
  RETURN jsonb_build_object('ok',true);
END $$;
