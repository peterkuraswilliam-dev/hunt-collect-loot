
CREATE TYPE public.delivery_status AS ENUM (
  'pending','processing','delivered','failed','partially_delivered','reversed','needs_review'
);

CREATE TYPE public.delivery_destination AS ENUM (
  'inventory','wallet','experience','assets','collections','titles','badges','cosmetics'
);

CREATE TABLE public.reward_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.reward_distribution_requests(id) ON DELETE CASCADE,
  player_id uuid,
  reward_id uuid REFERENCES public.rewards(id) ON DELETE SET NULL,
  reward_name text,
  reward_type_slug text,
  destination public.delivery_destination NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  status public.delivery_status NOT NULL DEFAULT 'pending',
  delivered_at timestamptz,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  last_retry_at timestamptz,
  dedupe_key text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX reward_deliveries_dedupe ON public.reward_deliveries(dedupe_key);
CREATE INDEX reward_deliveries_request_idx ON public.reward_deliveries(request_id);
CREATE INDEX reward_deliveries_status_idx ON public.reward_deliveries(status);
CREATE INDEX reward_deliveries_player_idx ON public.reward_deliveries(player_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_deliveries TO authenticated;
GRANT ALL ON public.reward_deliveries TO service_role;

ALTER TABLE public.reward_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage deliveries" ON public.reward_deliveries
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Players view their own deliveries" ON public.reward_deliveries
  FOR SELECT USING (auth.uid() = player_id);

CREATE TRIGGER reward_deliveries_touch
  BEFORE UPDATE ON public.reward_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.resolve_delivery_destination(p_type_slug text)
RETURNS public.delivery_destination
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_type_slug IN ('xp','experience','progression') THEN 'experience'::public.delivery_destination
    WHEN p_type_slug IN ('currency','credits','coins','gems','energy','wallet') THEN 'wallet'::public.delivery_destination
    WHEN p_type_slug IN ('asset','asset_grant') THEN 'assets'::public.delivery_destination
    WHEN p_type_slug IN ('collection','collection_item') THEN 'collections'::public.delivery_destination
    WHEN p_type_slug IN ('title') THEN 'titles'::public.delivery_destination
    WHEN p_type_slug IN ('badge','achievement') THEN 'badges'::public.delivery_destination
    WHEN p_type_slug IN ('cosmetic','skin','emote') THEN 'cosmetics'::public.delivery_destination
    ELSE 'inventory'::public.delivery_destination
  END
$$;

CREATE OR REPLACE FUNCTION public.deliver_distribution_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req public.reward_distribution_requests;
  item jsonb;
  v_idx int := 0;
  v_created int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_reward public.rewards;
  v_type public.reward_types;
  v_dest public.delivery_destination;
  v_qty int;
  v_key text;
  v_status public.delivery_status;
  v_err text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO req FROM public.reward_distribution_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF req.status <> 'completed' THEN
    RETURN jsonb_build_object('error','not_completed','status',req.status);
  END IF;

  INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
    VALUES (p_request_id, 'delivery_started', auth.uid(), '{}'::jsonb);

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(req.resolved_rewards,'[]'::jsonb))
  LOOP
    v_idx := v_idx + 1;
    v_status := 'pending';
    v_err := NULL;
    v_reward := NULL;
    v_type := NULL;
    v_dest := 'inventory';
    v_qty := GREATEST(COALESCE((item->>'quantity')::int, (item->>'min_quantity')::int, 1), 1);

    IF item ? 'reward_id' AND (item->>'reward_id') IS NOT NULL THEN
      SELECT * INTO v_reward FROM public.rewards WHERE id = (item->>'reward_id')::uuid;
      IF FOUND AND v_reward.reward_type_id IS NOT NULL THEN
        SELECT * INTO v_type FROM public.reward_types WHERE id = v_reward.reward_type_id;
      END IF;
    END IF;

    IF v_reward.id IS NULL THEN
      v_status := 'failed'; v_err := 'reward_not_found';
    ELSIF NOT v_reward.enabled OR v_reward.archived_at IS NOT NULL THEN
      v_status := 'failed'; v_err := 'reward_disabled_or_archived';
    ELSIF req.player_id IS NULL THEN
      v_status := 'failed'; v_err := 'missing_player';
    ELSE
      v_dest := public.resolve_delivery_destination(COALESCE(v_type.slug, v_type.kind));
      v_status := 'delivered';
    END IF;

    v_key := p_request_id::text || ':' || v_idx::text || ':' || COALESCE(v_reward.id::text,'null');

    BEGIN
      INSERT INTO public.reward_deliveries(
        request_id, player_id, reward_id, reward_name, reward_type_slug,
        destination, quantity, status, delivered_at, error_message, dedupe_key, detail
      ) VALUES (
        p_request_id, req.player_id, v_reward.id,
        COALESCE(v_reward.name, item->>'name'),
        COALESCE(v_type.slug, v_type.kind),
        v_dest, v_qty, v_status,
        CASE WHEN v_status = 'delivered' THEN now() ELSE NULL END,
        v_err, v_key,
        jsonb_build_object('source_item', item, 'index', v_idx)
      );
      IF v_status = 'delivered' THEN v_created := v_created + 1; ELSE v_failed := v_failed + 1; END IF;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
    VALUES (p_request_id, 'delivery_completed', auth.uid(),
      jsonb_build_object('delivered', v_created, 'failed', v_failed, 'skipped_duplicate', v_skipped));

  RETURN jsonb_build_object('ok', true, 'delivered', v_created, 'failed', v_failed, 'skipped_duplicate', v_skipped);
END $function$;

CREATE OR REPLACE FUNCTION public.retry_reward_delivery(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d public.reward_deliveries;
  v_reward public.rewards;
  v_type public.reward_types;
  v_dest public.delivery_destination;
  v_status public.delivery_status;
  v_err text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO d FROM public.reward_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF d.status = 'delivered' THEN RETURN jsonb_build_object('error','already_delivered'); END IF;

  v_err := NULL;
  IF d.reward_id IS NULL THEN
    v_status := 'failed'; v_err := 'reward_not_found';
  ELSE
    SELECT * INTO v_reward FROM public.rewards WHERE id = d.reward_id;
    IF NOT FOUND THEN v_status := 'failed'; v_err := 'reward_not_found';
    ELSIF NOT v_reward.enabled OR v_reward.archived_at IS NOT NULL THEN
      v_status := 'failed'; v_err := 'reward_disabled_or_archived';
    ELSIF d.player_id IS NULL THEN
      v_status := 'failed'; v_err := 'missing_player';
    ELSE
      IF v_reward.reward_type_id IS NOT NULL THEN
        SELECT * INTO v_type FROM public.reward_types WHERE id = v_reward.reward_type_id;
      END IF;
      v_dest := public.resolve_delivery_destination(COALESCE(v_type.slug, v_type.kind));
      v_status := 'delivered';
    END IF;
  END IF;

  UPDATE public.reward_deliveries SET
    status = v_status,
    destination = COALESCE(v_dest, destination),
    error_message = v_err,
    retry_count = retry_count + 1,
    last_retry_at = now(),
    delivered_at = CASE WHEN v_status = 'delivered' THEN now() ELSE delivered_at END
  WHERE id = p_delivery_id;

  INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
    VALUES (d.request_id, 'delivery_retried', auth.uid(),
      jsonb_build_object('delivery_id', p_delivery_id, 'status', v_status, 'error', v_err));

  RETURN jsonb_build_object('ok', true, 'status', v_status, 'error', v_err);
END $function$;

CREATE OR REPLACE FUNCTION public.retry_failed_deliveries(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record; n int := 0; ok int := 0; bad int := 0; res jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOR r IN SELECT id FROM public.reward_deliveries
    WHERE request_id = p_request_id AND status IN ('failed','needs_review','partially_delivered')
  LOOP
    res := public.retry_reward_delivery(r.id);
    n := n + 1;
    IF (res->>'status') = 'delivered' THEN ok := ok + 1; ELSE bad := bad + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'attempted', n, 'delivered', ok, 'still_failed', bad);
END $function$;

CREATE OR REPLACE FUNCTION public.cancel_reward_delivery(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE d public.reward_deliveries;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO d FROM public.reward_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF d.status = 'delivered' THEN RETURN jsonb_build_object('error','already_delivered'); END IF;
  UPDATE public.reward_deliveries SET status = 'reversed', error_message = 'cancelled_by_admin' WHERE id = p_delivery_id;
  INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
    VALUES (d.request_id, 'delivery_cancelled', auth.uid(), jsonb_build_object('delivery_id', p_delivery_id));
  RETURN jsonb_build_object('ok', true);
END $function$;

CREATE OR REPLACE FUNCTION public.mark_delivery_for_review(p_delivery_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE d public.reward_deliveries;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO d FROM public.reward_deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  UPDATE public.reward_deliveries SET status = 'needs_review', error_message = COALESCE(p_note, error_message) WHERE id = p_delivery_id;
  INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
    VALUES (d.request_id, 'delivery_marked_for_review', auth.uid(), jsonb_build_object('delivery_id', p_delivery_id, 'note', p_note));
  RETURN jsonb_build_object('ok', true);
END $function$;

-- Seed demo deliveries for existing completed requests
DO $$
DECLARE
  r record;
  ritem jsonb;
  rew public.rewards;
  rt public.reward_types;
  v_dest public.delivery_destination;
  v_qty int;
  v_status public.delivery_status;
  v_err text;
  v_idx int;
  v_key text;
  rnd numeric;
BEGIN
  FOR r IN
    SELECT req.* FROM public.reward_distribution_requests req
    WHERE req.status = 'completed'
      AND jsonb_typeof(req.resolved_rewards) = 'array'
      AND jsonb_array_length(req.resolved_rewards) > 0
    LIMIT 40
  LOOP
    v_idx := 0;
    FOR ritem IN SELECT * FROM jsonb_array_elements(r.resolved_rewards) LOOP
      v_idx := v_idx + 1;
      rew := NULL; rt := NULL; v_err := NULL;
      v_qty := GREATEST(COALESCE((ritem->>'quantity')::int, (ritem->>'min_quantity')::int, 1), 1);

      IF ritem ? 'reward_id' AND (ritem->>'reward_id') IS NOT NULL THEN
        SELECT * INTO rew FROM public.rewards WHERE id = (ritem->>'reward_id')::uuid;
        IF FOUND AND rew.reward_type_id IS NOT NULL THEN
          SELECT * INTO rt FROM public.reward_types WHERE id = rew.reward_type_id;
        END IF;
      END IF;

      IF rew.id IS NULL THEN
        v_dest := 'inventory'; v_status := 'failed'; v_err := 'reward_not_found';
      ELSIF r.player_id IS NULL THEN
        v_dest := 'inventory'; v_status := 'failed'; v_err := 'missing_player';
      ELSE
        v_dest := public.resolve_delivery_destination(COALESCE(rt.slug, rt.kind));
        rnd := random();
        IF rnd < 0.82 THEN v_status := 'delivered';
        ELSIF rnd < 0.90 THEN v_status := 'failed'; v_err := 'integration_timeout';
        ELSIF rnd < 0.95 THEN v_status := 'partially_delivered'; v_err := 'stack_cap_reached';
        ELSIF rnd < 0.98 THEN v_status := 'pending';
        ELSE v_status := 'needs_review'; v_err := 'flagged_by_admin';
        END IF;
      END IF;

      v_key := r.id::text || ':' || v_idx::text || ':' || COALESCE(rew.id::text,'null');

      INSERT INTO public.reward_deliveries(
        request_id, player_id, reward_id, reward_name, reward_type_slug,
        destination, quantity, status, delivered_at, error_message, dedupe_key,
        retry_count, detail
      ) VALUES (
        r.id, r.player_id, rew.id,
        COALESCE(rew.name, ritem->>'name'),
        COALESCE(rt.slug, rt.kind),
        v_dest, v_qty, v_status,
        CASE WHEN v_status IN ('delivered','partially_delivered') THEN r.processed_at ELSE NULL END,
        v_err, v_key,
        CASE WHEN v_status = 'failed' THEN (floor(random()*3))::int ELSE 0 END,
        jsonb_build_object('source_item', ritem, 'index', v_idx, 'seeded', true)
      )
      ON CONFLICT (dedupe_key) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
