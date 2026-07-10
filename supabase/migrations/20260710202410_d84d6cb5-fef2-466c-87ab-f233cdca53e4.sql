
-- Ensure an XP source exists for asset production
INSERT INTO public.xp_sources (slug, name, description, category, enabled, base_xp, status, visible)
SELECT 'asset_production', 'Asset Production', 'XP awarded when players collect production from owned assets.', 'passive', true, 0, 'active', true
WHERE NOT EXISTS (SELECT 1 FROM public.xp_sources WHERE slug = 'asset_production');

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
  total_xp numeric := 0;
  bonus_max int;
  player_type_id uuid;
  xp_source_id uuid;
  awarded_xp bigint := 0;
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
    COALESCE(SUM(a.energy_per_hour * ui.quantity),0),
    COALESCE(SUM(a.xp_per_hour * ui.quantity),0)
  INTO total_credits, total_energy, total_xp
  FROM public.user_inventory ui
  JOIN public.assets a ON a.id = ui.asset_id
  WHERE ui.user_id = p_user;

  total_credits := floor(total_credits * hours * mult.production_multiplier * mult.credits_multiplier);
  total_energy := floor(total_energy * hours * mult.production_multiplier * mult.energy_production_multiplier);
  total_xp := floor(total_xp * hours * mult.production_multiplier);

  bonus_max := COALESCE(s.bonus_energy_max,0);
  UPDATE public.user_stats SET
    credits = credits + total_credits::int,
    energy = LEAST(cfg.energy_max + bonus_max, energy + total_energy::int),
    production_collected_at = now()
  WHERE user_id = p_user;

  -- Award XP through progression engine (Player type)
  IF total_xp > 0 THEN
    SELECT id INTO player_type_id FROM public.progression_types
      WHERE category = 'player' OR slug = 'player' OR entity_type = 'player'
      ORDER BY (category = 'player') DESC, (slug = 'player') DESC, sort_order ASC
      LIMIT 1;
    SELECT id INTO xp_source_id FROM public.xp_sources WHERE slug = 'asset_production' LIMIT 1;
    IF player_type_id IS NOT NULL THEN
      PERFORM public.submit_xp_event(
        p_user, player_type_id, xp_source_id, total_xp::bigint,
        'asset_production', jsonb_build_object('hours', hours)
      );
      awarded_xp := total_xp::bigint;
    END IF;
  END IF;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES
    (p_user, 'collect_production', jsonb_build_object('credits',total_credits,'energy',total_energy,'xp',awarded_xp,'hours',hours));

  RETURN jsonb_build_object('credits',total_credits,'xp',awarded_xp,'energy',total_energy,'hours',hours);
END $function$;
