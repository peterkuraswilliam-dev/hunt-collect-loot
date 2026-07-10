CREATE OR REPLACE FUNCTION public.claim_collection_bonus(p_user uuid, p_collection_id uuid, p_threshold integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_assets int;
  owned int;
  pct numeric;
  bonus jsonb;
  spin_amt int := 0;
  energy_bonus int := 0;
  credits_amt int := 0;
  xp_amt bigint := 0;
  col public.collections;
  player_type_id uuid;
  xp_source_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO col FROM public.collections WHERE id = p_collection_id;
  SELECT COUNT(*) INTO total_assets FROM public.assets WHERE collection_id = p_collection_id;
  IF total_assets = 0 THEN RETURN jsonb_build_object('error','empty_collection'); END IF;
  SELECT COUNT(DISTINCT a.id) INTO owned FROM public.assets a
    JOIN public.user_inventory ui ON ui.asset_id = a.id AND ui.user_id = p_user
    WHERE a.collection_id = p_collection_id AND ui.quantity > 0;
  pct := (owned::numeric / total_assets) * 100;
  IF pct < p_threshold THEN RETURN jsonb_build_object('error','not_eligible','progress',pct); END IF;
  SELECT b INTO bonus FROM public.collections c, jsonb_array_elements(c.bonuses) b
    WHERE c.id = p_collection_id AND (b->>'threshold')::int = p_threshold LIMIT 1;
  IF bonus IS NULL THEN RETURN jsonb_build_object('error','no_bonus'); END IF;

  INSERT INTO public.user_collection_claims (user_id, collection_id, threshold)
    VALUES (p_user, p_collection_id, p_threshold);

  spin_amt := COALESCE((bonus->>'spin_tokens')::int, 0);
  IF bonus->>'type' = 'energy_max' THEN
    energy_bonus := COALESCE((bonus->>'value')::int, 0);
  ELSIF bonus->>'type' = 'credits' THEN
    credits_amt := credits_amt + COALESCE((bonus->>'value')::int, 0);
  ELSIF bonus->>'type' = 'xp' THEN
    xp_amt := xp_amt + COALESCE((bonus->>'value')::bigint, 0);
  END IF;

  -- On full completion, add the collection-level rewards
  IF p_threshold >= 100 THEN
    credits_amt := credits_amt + COALESCE(col.reward_credits, 0);
    xp_amt := xp_amt + COALESCE(col.reward_xp, 0)::bigint;
  END IF;

  UPDATE public.user_stats SET
    bonus_energy_max = bonus_energy_max + energy_bonus,
    spin_tokens = spin_tokens + spin_amt,
    credits = credits + credits_amt,
    collections_completed = collections_completed + CASE WHEN bonus->>'type' = 'realm_unlock' OR p_threshold >= 100 THEN 1 ELSE 0 END
  WHERE user_id = p_user;

  -- Award XP through the progression engine so UI reflects it
  IF xp_amt > 0 THEN
    SELECT id INTO player_type_id FROM public.progression_types
      WHERE category = 'player' OR slug = 'player' OR entity_type = 'player'
      ORDER BY (category = 'player') DESC, (slug = 'player') DESC, sort_order ASC
      LIMIT 1;
    SELECT id INTO xp_source_id FROM public.xp_sources WHERE slug IN ('collection_bonus','collection_complete','asset_production') ORDER BY (slug='collection_bonus') DESC, (slug='collection_complete') DESC LIMIT 1;
    IF player_type_id IS NOT NULL THEN
      PERFORM public.submit_xp_event(
        p_user, player_type_id, xp_source_id, xp_amt,
        'collection_bonus', jsonb_build_object('collection_id', p_collection_id, 'threshold', p_threshold)
      );
    END IF;
  END IF;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES (p_user,'claim_bonus',jsonb_build_object('collection_id',p_collection_id,'threshold',p_threshold,'bonus',bonus,'credits',credits_amt,'xp',xp_amt));
  RETURN jsonb_build_object('ok',true,'bonus',bonus,'credits',credits_amt,'xp',xp_amt,'spin_tokens',spin_amt);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('error','already_claimed');
END $function$;