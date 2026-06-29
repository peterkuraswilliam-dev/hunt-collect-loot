-- Phase 1: Remove legacy XP system (schema + functions).
-- Preserve user_stats.xp and user_stats.level data for future migration.

-- 1. Drop XP curve setting
ALTER TABLE public.game_settings DROP COLUMN IF EXISTS xp_per_level;

-- 2. Drop legacy XP multiplier
ALTER TABLE public.economy_multipliers DROP COLUMN IF EXISTS xp_multiplier;

-- 3. Remove XP awards from collect_production (still returns xp:0 for caller compat)
CREATE OR REPLACE FUNCTION public.collect_production(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mult public.economy_multipliers;
  cfg public.game_settings;
  s public.user_stats;
  hours numeric;
  total_credits numeric := 0;
  total_energy numeric := 0;
  bonus_max int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO mult FROM public.economy_multipliers WHERE id = 1;
  SELECT * INTO cfg FROM public.game_settings WHERE id = 1;
  SELECT * INTO s FROM public.user_stats WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','no_stats'); END IF;

  hours := LEAST(mult.max_offline_hours::numeric, EXTRACT(EPOCH FROM (now() - s.production_collected_at))/3600.0);
  IF hours <= 0 THEN RETURN jsonb_build_object('credits',0,'xp',0,'energy',0,'hours',0); END IF;

  SELECT
    COALESCE(SUM(a.credits_per_hour * ui.quantity),0),
    COALESCE(SUM(a.energy_per_hour * ui.quantity),0)
  INTO total_credits, total_energy
  FROM public.user_inventory ui
  JOIN public.assets a ON a.id = ui.asset_id
  WHERE ui.user_id = p_user;

  total_credits := floor(total_credits * hours * mult.production_multiplier * mult.credits_multiplier);
  total_energy := floor(total_energy * hours * mult.production_multiplier * mult.energy_production_multiplier);

  bonus_max := COALESCE(s.bonus_energy_max,0);
  UPDATE public.user_stats SET
    credits = credits + total_credits::int,
    energy = LEAST(cfg.energy_max + bonus_max, energy + total_energy::int),
    production_collected_at = now()
  WHERE user_id = p_user;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES
    (p_user, 'collect_production', jsonb_build_object('credits',total_credits,'energy',total_energy,'hours',hours));

  RETURN jsonb_build_object('credits',total_credits,'xp',0,'energy',total_energy,'hours',hours);
END $function$;

-- 4. Remove XP branch from spin_wheel + delete legacy XP spin rewards
DELETE FROM public.spin_rewards WHERE kind = 'xp';

CREATE OR REPLACE FUNCTION public.spin_wheel(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.user_stats;
  cfg public.game_settings;
  mult public.economy_multipliers;
  total_w int := 0;
  pick int;
  acc int := 0;
  r record;
  chosen public.spin_rewards;
  amount int;
  asset_row public.assets;
  pack_row public.packs;
  bonus_max int;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO s FROM public.user_stats WHERE user_id = p_user FOR UPDATE;
  IF s.spin_tokens < 1 THEN RETURN jsonb_build_object('error','no_tokens'); END IF;
  SELECT * INTO cfg FROM public.game_settings WHERE id = 1;
  SELECT * INTO mult FROM public.economy_multipliers WHERE id = 1;
  SELECT SUM(weight) INTO total_w FROM public.spin_rewards WHERE active = true;
  IF COALESCE(total_w,0) = 0 THEN RETURN jsonb_build_object('error','no_rewards'); END IF;
  pick := floor(random() * total_w)::int;
  FOR r IN SELECT * FROM public.spin_rewards WHERE active = true ORDER BY id LOOP
    acc := acc + r.weight;
    IF pick < acc THEN chosen := r; EXIT; END IF;
  END LOOP;

  UPDATE public.user_stats SET spin_tokens = spin_tokens - 1 WHERE user_id = p_user;
  amount := floor(random() * (chosen.max_amount - chosen.min_amount + 1) + chosen.min_amount)::int;
  bonus_max := COALESCE(s.bonus_energy_max,0);

  CASE chosen.kind
    WHEN 'credits' THEN
      amount := floor(amount * mult.spin_multiplier * mult.credits_multiplier)::int;
      UPDATE public.user_stats SET credits = credits + amount WHERE user_id = p_user;
    WHEN 'energy' THEN
      UPDATE public.user_stats SET energy = LEAST(cfg.energy_max + bonus_max, energy + amount) WHERE user_id = p_user;
    WHEN 'pack' THEN
      SELECT * INTO pack_row FROM public.packs WHERE slug = chosen.pack_slug LIMIT 1;
      IF FOUND THEN
        INSERT INTO public.user_packs (user_id, pack_id, quantity) VALUES (p_user, pack_row.id, amount)
          ON CONFLICT (user_id, pack_id) DO UPDATE SET quantity = public.user_packs.quantity + EXCLUDED.quantity;
      END IF;
    WHEN 'asset' THEN
      SELECT * INTO asset_row FROM public.assets WHERE rarity::text = chosen.asset_rarity ORDER BY random() LIMIT 1;
      IF FOUND THEN
        INSERT INTO public.user_inventory (user_id, asset_id, quantity) VALUES (p_user, asset_row.id, amount)
          ON CONFLICT (user_id, asset_id) DO UPDATE SET quantity = public.user_inventory.quantity + EXCLUDED.quantity;
      END IF;
    ELSE
      -- unknown / legacy kinds: no-op
      amount := 0;
  END CASE;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES (p_user,'spin',jsonb_build_object('reward',row_to_json(chosen),'amount',amount));
  RETURN jsonb_build_object('reward',row_to_json(chosen),'amount',amount,'asset',row_to_json(asset_row),'pack',row_to_json(pack_row));
END $function$;

-- 5. Tighten spin_rewards.kind to exclude xp going forward
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.spin_rewards'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.spin_rewards DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.spin_rewards
  ADD CONSTRAINT spin_rewards_kind_check
  CHECK (kind IN ('credits','energy','pack','asset'));

-- 6. Clean legacy XP rows from reward catalog tables (best-effort, by kind column if present)
DELETE FROM public.reward_types WHERE kind = 'xp';