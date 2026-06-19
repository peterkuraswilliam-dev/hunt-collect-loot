
-- Lock down all SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_energy_regen(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dig_tile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.open_pack(uuid, uuid) FROM PUBLIC, anon;

-- Recreate dig_tile and open_pack with auth.uid() guard, allow authenticated to execute
CREATE OR REPLACE FUNCTION public.dig_tile(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.user_stats;
  cfg public.game_settings;
  rewards jsonb;
  total_w int := 0;
  r jsonb;
  pick int;
  acc int := 0;
  chosen jsonb;
  result jsonb := '{}'::jsonb;
  asset_row public.assets;
  pack_row public.packs;
  rarity_pick text;
  rarity_total int := 0;
  rarity_acc int := 0;
  rkey text;
  rval int;
  credits_amt int;
  xp_amt int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO cfg FROM public.game_settings WHERE id = 1;
  s := public.apply_energy_regen(p_user);
  IF s.energy < cfg.dig_energy_cost THEN
    RETURN jsonb_build_object('error','not_enough_energy');
  END IF;

  rewards := cfg.treasure_rewards;
  FOR r IN SELECT * FROM jsonb_array_elements(rewards) LOOP
    total_w := total_w + (r->>'weight')::int;
  END LOOP;
  pick := floor(random() * total_w)::int;
  FOR r IN SELECT * FROM jsonb_array_elements(rewards) LOOP
    acc := acc + (r->>'weight')::int;
    IF pick < acc THEN chosen := r; EXIT; END IF;
  END LOOP;

  UPDATE public.user_stats SET energy = energy - cfg.dig_energy_cost, energy_updated_at = COALESCE(energy_updated_at, now()) WHERE user_id = p_user;

  CASE chosen->>'type'
    WHEN 'empty' THEN result := jsonb_build_object('type','empty');
    WHEN 'credits' THEN
      credits_amt := floor(random() * ((chosen->>'max')::int - (chosen->>'min')::int + 1) + (chosen->>'min')::int)::int;
      UPDATE public.user_stats SET credits = credits + credits_amt WHERE user_id = p_user;
      result := jsonb_build_object('type','credits','amount',credits_amt);
    WHEN 'xp' THEN
      xp_amt := floor(random() * ((chosen->>'max')::int - (chosen->>'min')::int + 1) + (chosen->>'min')::int)::int;
      UPDATE public.user_stats SET xp = xp + xp_amt, level = GREATEST(1, ((xp + xp_amt) / cfg.xp_per_level) + 1) WHERE user_id = p_user;
      result := jsonb_build_object('type','xp','amount',xp_amt);
    WHEN 'asset' THEN
      FOR rkey, rval IN SELECT key, value::int FROM jsonb_each_text(chosen->'rarity_weights') LOOP
        rarity_total := rarity_total + rval;
      END LOOP;
      pick := floor(random() * rarity_total)::int;
      FOR rkey, rval IN SELECT key, value::int FROM jsonb_each_text(chosen->'rarity_weights') LOOP
        rarity_acc := rarity_acc + rval;
        IF pick < rarity_acc THEN rarity_pick := rkey; EXIT; END IF;
      END LOOP;
      SELECT * INTO asset_row FROM public.assets WHERE rarity = rarity_pick::public.rarity ORDER BY random() LIMIT 1;
      IF FOUND THEN
        INSERT INTO public.user_inventory (user_id, asset_id, quantity) VALUES (p_user, asset_row.id, 1)
        ON CONFLICT (user_id, asset_id) DO UPDATE SET quantity = public.user_inventory.quantity + 1;
        result := jsonb_build_object('type','asset','asset', to_jsonb(asset_row));
      ELSE
        result := jsonb_build_object('type','empty');
      END IF;
    WHEN 'pack' THEN
      SELECT * INTO pack_row FROM public.packs WHERE slug = chosen->>'pack_slug' LIMIT 1;
      IF FOUND THEN
        INSERT INTO public.user_packs (user_id, pack_id, quantity) VALUES (p_user, pack_row.id, 1)
        ON CONFLICT (user_id, pack_id) DO UPDATE SET quantity = public.user_packs.quantity + 1;
        result := jsonb_build_object('type','pack','pack', to_jsonb(pack_row));
      END IF;
  END CASE;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES (p_user, 'dig', result);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.open_pack(p_user uuid, p_pack_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.user_stats;
  pack_row public.packs;
  drops jsonb := '[]'::jsonb;
  i int;
  total_w int := 0;
  r record;
  pick int;
  acc int := 0;
  chosen_rarity public.rarity;
  asset_row public.assets;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO pack_row FROM public.packs WHERE id = p_pack_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','pack_not_found'); END IF;
  s := public.apply_energy_regen(p_user);
  IF s.credits < pack_row.price_credits THEN
    RETURN jsonb_build_object('error','not_enough_credits');
  END IF;
  SELECT SUM(weight) INTO total_w FROM public.pack_drop_rates WHERE pack_id = p_pack_id;
  IF total_w IS NULL OR total_w = 0 THEN RETURN jsonb_build_object('error','no_drop_rates'); END IF;

  UPDATE public.user_stats SET credits = credits - pack_row.price_credits, packs_opened = packs_opened + 1 WHERE user_id = p_user;

  FOR i IN 1..pack_row.assets_per_pack LOOP
    pick := floor(random() * total_w)::int;
    acc := 0;
    FOR r IN SELECT rarity, weight FROM public.pack_drop_rates WHERE pack_id = p_pack_id ORDER BY weight LOOP
      acc := acc + r.weight;
      IF pick < acc THEN chosen_rarity := r.rarity; EXIT; END IF;
    END LOOP;
    SELECT * INTO asset_row FROM public.assets WHERE rarity = chosen_rarity ORDER BY random() LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.user_inventory (user_id, asset_id, quantity) VALUES (p_user, asset_row.id, 1)
      ON CONFLICT (user_id, asset_id) DO UPDATE SET quantity = public.user_inventory.quantity + 1;
      drops := drops || to_jsonb(asset_row);
    END IF;
  END LOOP;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES (p_user, 'open_pack', jsonb_build_object('pack', to_jsonb(pack_row), 'drops', drops));
  RETURN jsonb_build_object('pack', to_jsonb(pack_row), 'drops', drops);
END $$;

GRANT EXECUTE ON FUNCTION public.dig_tile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_pack(uuid, uuid) TO authenticated;
