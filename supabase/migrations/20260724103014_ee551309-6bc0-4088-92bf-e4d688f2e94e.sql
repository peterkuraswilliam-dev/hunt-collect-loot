
-- 1. Enum for claim status
DO $$ BEGIN
  CREATE TYPE public.claim_status AS ENUM ('pending','available','claimed','expired','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend requests
ALTER TABLE public.reward_distribution_requests
  ADD COLUMN IF NOT EXISTS claim_mode text NOT NULL DEFAULT 'instant'
    CHECK (claim_mode IN ('instant','manual','claim_all','auto_login','scheduled')),
  ADD COLUMN IF NOT EXISTS expiry_policy jsonb NOT NULL DEFAULT '{"kind":"none"}'::jsonb,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 3. Reward inbox
CREATE TABLE IF NOT EXISTS public.reward_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.reward_distribution_requests(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.reward_deliveries(id) ON DELETE SET NULL,
  player_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.rewards(id) ON DELETE SET NULL,
  reward_name text,
  reward_type_slug text,
  quantity int NOT NULL DEFAULT 1,
  source_module text,
  source_record_name text,
  source_item jsonb NOT NULL DEFAULT '{}'::jsonb,
  item_index int NOT NULL DEFAULT 0,
  status public.claim_status NOT NULL DEFAULT 'available',
  expires_at timestamptz,
  claimed_at timestamptz,
  cancelled_at timestamptz,
  claim_error text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, item_index)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_inbox TO authenticated;
GRANT ALL ON public.reward_inbox TO service_role;

ALTER TABLE public.reward_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own inbox" ON public.reward_inbox
  FOR SELECT TO authenticated USING (player_id = auth.uid());
CREATE POLICY "Admins manage all inbox" ON public.reward_inbox
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS reward_inbox_player_idx ON public.reward_inbox(player_id, status);
CREATE INDEX IF NOT EXISTS reward_inbox_request_idx ON public.reward_inbox(request_id);
CREATE INDEX IF NOT EXISTS reward_inbox_expiry_idx ON public.reward_inbox(expires_at) WHERE status = 'available';

CREATE TRIGGER reward_inbox_touch BEFORE UPDATE ON public.reward_inbox
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Helper: compute expires_at from a policy jsonb
CREATE OR REPLACE FUNCTION public.compute_inbox_expiry(p_policy jsonb)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE k text;
BEGIN
  k := COALESCE(p_policy->>'kind','none');
  IF k = 'fixed' AND (p_policy->>'at') IS NOT NULL THEN
    RETURN (p_policy->>'at')::timestamptz;
  ELSIF k = 'after_days' AND (p_policy->>'days') IS NOT NULL THEN
    RETURN now() + ((p_policy->>'days')::int * interval '1 day');
  END IF;
  RETURN NULL;
END $$;

-- 5. Replace deliver_distribution_request to branch on claim_mode
CREATE OR REPLACE FUNCTION public.deliver_distribution_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  req public.reward_distribution_requests;
  item jsonb;
  v_idx int := 0;
  v_created int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_inbox int := 0;
  v_reward public.rewards;
  v_type public.reward_types;
  v_dest public.delivery_destination;
  v_qty int;
  v_key text;
  v_status public.delivery_status;
  v_err text;
  v_expiry timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO req FROM public.reward_distribution_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF req.status <> 'completed' THEN
    RETURN jsonb_build_object('error','not_completed','status',req.status);
  END IF;

  v_expiry := COALESCE(req.expires_at, public.compute_inbox_expiry(req.expiry_policy));

  INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
    VALUES (p_request_id, 'delivery_started', auth.uid(),
      jsonb_build_object('claim_mode', req.claim_mode));

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(req.resolved_rewards,'[]'::jsonb))
  LOOP
    v_idx := v_idx + 1;
    v_reward := NULL;
    v_type := NULL;
    v_qty := GREATEST(COALESCE((item->>'quantity')::int, (item->>'min_quantity')::int, 1), 1);

    IF item ? 'reward_id' AND (item->>'reward_id') IS NOT NULL THEN
      SELECT * INTO v_reward FROM public.rewards WHERE id = (item->>'reward_id')::uuid;
      IF FOUND AND v_reward.reward_type_id IS NOT NULL THEN
        SELECT * INTO v_type FROM public.reward_types WHERE id = v_reward.reward_type_id;
      END IF;
    END IF;

    IF req.claim_mode = 'instant' THEN
      v_status := 'pending';
      v_err := NULL;
      v_dest := 'inventory';
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
    ELSE
      -- Store in inbox for claim
      BEGIN
        INSERT INTO public.reward_inbox(
          request_id, player_id, reward_id, reward_name, reward_type_slug,
          quantity, source_module, source_record_name, source_item, item_index,
          status, expires_at
        ) VALUES (
          p_request_id, req.player_id, v_reward.id,
          COALESCE(v_reward.name, item->>'name'),
          COALESCE(v_type.slug, v_type.kind),
          v_qty, req.source_module, req.source_record_name, item, v_idx,
          CASE WHEN req.player_id IS NULL THEN 'failed'::public.claim_status ELSE 'available'::public.claim_status END,
          v_expiry
        );
        v_inbox := v_inbox + 1;
      EXCEPTION WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
      END;
    END IF;
  END LOOP;

  INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
    VALUES (p_request_id, 'delivery_completed', auth.uid(),
      jsonb_build_object('delivered', v_created, 'failed', v_failed, 'inboxed', v_inbox, 'skipped_duplicate', v_skipped));

  RETURN jsonb_build_object('ok', true,
    'claim_mode', req.claim_mode,
    'delivered', v_created, 'failed', v_failed,
    'inboxed', v_inbox, 'skipped_duplicate', v_skipped);
END $function$;

-- 6. Claim single inbox reward
CREATE OR REPLACE FUNCTION public.claim_inbox_reward(p_inbox_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  inb public.reward_inbox;
  v_reward public.rewards;
  v_type public.reward_types;
  v_dest public.delivery_destination;
  v_delivery_id uuid;
  v_key text;
  v_is_admin boolean := public.has_role(auth.uid(),'admin');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO inb FROM public.reward_inbox WHERE id = p_inbox_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;

  IF NOT v_is_admin AND inb.player_id <> auth.uid() THEN
    RETURN jsonb_build_object('error','forbidden');
  END IF;

  IF inb.status = 'claimed' THEN RETURN jsonb_build_object('error','already_claimed'); END IF;
  IF inb.status IN ('expired','cancelled') THEN
    RETURN jsonb_build_object('error', inb.status::text);
  END IF;
  IF inb.expires_at IS NOT NULL AND inb.expires_at < now() THEN
    UPDATE public.reward_inbox SET status='expired' WHERE id = inb.id;
    RETURN jsonb_build_object('error','expired');
  END IF;

  IF inb.reward_id IS NULL THEN
    UPDATE public.reward_inbox SET status='failed', claim_error='reward_missing' WHERE id = inb.id;
    RETURN jsonb_build_object('error','reward_missing');
  END IF;

  SELECT * INTO v_reward FROM public.rewards WHERE id = inb.reward_id;
  IF NOT FOUND OR NOT v_reward.enabled OR v_reward.archived_at IS NOT NULL THEN
    UPDATE public.reward_inbox SET status='failed', claim_error='reward_disabled_or_archived' WHERE id = inb.id;
    RETURN jsonb_build_object('error','reward_disabled_or_archived');
  END IF;
  IF v_reward.reward_type_id IS NOT NULL THEN
    SELECT * INTO v_type FROM public.reward_types WHERE id = v_reward.reward_type_id;
  END IF;
  v_dest := public.resolve_delivery_destination(COALESCE(v_type.slug, v_type.kind));

  v_key := 'inbox:' || inb.id::text;

  BEGIN
    INSERT INTO public.reward_deliveries(
      request_id, player_id, reward_id, reward_name, reward_type_slug,
      destination, quantity, status, delivered_at, dedupe_key, detail
    ) VALUES (
      inb.request_id, inb.player_id, v_reward.id,
      v_reward.name, COALESCE(v_type.slug, v_type.kind),
      v_dest, inb.quantity, 'delivered', now(), v_key,
      jsonb_build_object('inbox_id', inb.id, 'source_item', inb.source_item, 'index', inb.item_index)
    ) RETURNING id INTO v_delivery_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_delivery_id FROM public.reward_deliveries WHERE dedupe_key = v_key;
  END;

  UPDATE public.reward_inbox
    SET status='claimed', claimed_at=now(), delivery_id=v_delivery_id, claim_error=NULL
    WHERE id = inb.id;

  INSERT INTO public.reward_distribution_activity(request_id, action, actor_id, detail)
    VALUES (inb.request_id, 'claimed', auth.uid(),
      jsonb_build_object('inbox_id', inb.id, 'delivery_id', v_delivery_id));

  RETURN jsonb_build_object('ok', true, 'delivery_id', v_delivery_id);
END $function$;

-- 7. Claim all available for current user
CREATE OR REPLACE FUNCTION public.claim_all_inbox_rewards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE r record; v_ok int := 0; v_err int := 0; v_res jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  FOR r IN
    SELECT id FROM public.reward_inbox
      WHERE player_id = auth.uid()
        AND status = 'available'
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at
  LOOP
    v_res := public.claim_inbox_reward(r.id);
    IF (v_res->>'ok')::boolean THEN v_ok := v_ok + 1; ELSE v_err := v_err + 1; END IF;
  END LOOP;
  RETURN jsonb_build_object('claimed', v_ok, 'failed', v_err);
END $function$;

-- 8. Expiry sweep
CREATE OR REPLACE FUNCTION public.expire_inbox_rewards()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE n int;
BEGIN
  UPDATE public.reward_inbox
    SET status='expired'
    WHERE status='available' AND expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$;

-- 9. Admin actions
CREATE OR REPLACE FUNCTION public.admin_reopen_inbox(p_inbox_id uuid, p_new_expires_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.reward_inbox
    SET status='available', expires_at = COALESCE(p_new_expires_at, expires_at + interval '30 days'),
        claim_error = NULL
    WHERE id = p_inbox_id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_cancel_inbox(p_inbox_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.reward_inbox
    SET status='cancelled', cancelled_at = now()
    WHERE id = p_inbox_id AND status IN ('available','pending','failed');
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_retry_failed_claim(p_inbox_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.reward_inbox
    SET status='available', claim_error = NULL
    WHERE id = p_inbox_id AND status = 'failed';
  RETURN public.claim_inbox_reward(p_inbox_id);
END $$;

-- Admin manual grant: creates a completed distribution request + inbox row
CREATE OR REPLACE FUNCTION public.admin_grant_reward(
  p_player_id uuid,
  p_reward_id uuid,
  p_quantity int DEFAULT 1,
  p_claim_mode text DEFAULT 'manual',
  p_expiry_policy jsonb DEFAULT '{"kind":"none"}'::jsonb,
  p_source_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req_id uuid;
  v_reward public.rewards;
  v_type public.reward_types;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_reward FROM public.rewards WHERE id = p_reward_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','reward_not_found'); END IF;
  IF v_reward.reward_type_id IS NOT NULL THEN
    SELECT * INTO v_type FROM public.reward_types WHERE id = v_reward.reward_type_id;
  END IF;

  INSERT INTO public.reward_distribution_requests(
    source_module, source_record_name, player_id, request_type, reward_id,
    quantity, status, resolved_rewards, processed_at, requested_by,
    claim_mode, expiry_policy, expires_at
  ) VALUES (
    'admin', COALESCE(p_source_note,'Manual grant'), p_player_id, 'direct', p_reward_id,
    GREATEST(p_quantity,1), 'completed',
    jsonb_build_array(jsonb_build_object(
      'reward_id', p_reward_id,
      'name', v_reward.name,
      'quantity', GREATEST(p_quantity,1),
      'guaranteed', true
    )),
    now(), auth.uid(),
    COALESCE(p_claim_mode,'manual'), COALESCE(p_expiry_policy,'{"kind":"none"}'::jsonb),
    public.compute_inbox_expiry(COALESCE(p_expiry_policy,'{"kind":"none"}'::jsonb))
  ) RETURNING id INTO v_req_id;

  PERFORM public.deliver_distribution_request(v_req_id);
  RETURN jsonb_build_object('ok', true, 'request_id', v_req_id);
END $$;

GRANT EXECUTE ON FUNCTION public.claim_inbox_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_all_inbox_rewards() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_inbox_rewards() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reopen_inbox(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_inbox(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_retry_failed_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_reward(uuid, uuid, int, text, jsonb, text) TO authenticated;
