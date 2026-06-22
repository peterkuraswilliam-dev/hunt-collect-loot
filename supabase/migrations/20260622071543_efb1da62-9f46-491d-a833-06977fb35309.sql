
-- ============ ASSETS: production rates ============
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS energy_per_hour numeric(10,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_per_hour numeric(10,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS xp_per_hour numeric(10,3) NOT NULL DEFAULT 0;

-- ============ COLLECTIONS: bonuses + rewards ============
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS bonuses jsonb NOT NULL DEFAULT '[
    {"threshold":25,"type":"energy_max","value":5,"spin_tokens":1,"label":"25% — +5 Max Energy & 1 Spin"},
    {"threshold":50,"type":"energy_max","value":10,"spin_tokens":2,"label":"50% — +10 Max Energy & 2 Spins"},
    {"threshold":75,"type":"energy_max","value":15,"spin_tokens":3,"label":"75% — +15 Max Energy & 3 Spins"},
    {"threshold":100,"type":"realm_unlock","value":0,"spin_tokens":5,"label":"100% — Realm Unlocked & 5 Spins"}
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS realm_slug text;

-- ============ USER STATS: spin tokens + last collection ============
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS spin_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_collected_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS bonus_energy_max integer NOT NULL DEFAULT 0;

-- ============ COLLECTION CLAIMS ============
CREATE TABLE IF NOT EXISTS public.user_collection_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  threshold integer NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, collection_id, threshold)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_collection_claims TO authenticated;
GRANT ALL ON public.user_collection_claims TO service_role;
ALTER TABLE public.user_collection_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own claims read" ON public.user_collection_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own claims insert" ON public.user_collection_claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ SPIN REWARDS (CMS) ============
CREATE TABLE IF NOT EXISTS public.spin_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('credits','energy','xp','pack','asset')),
  min_amount integer NOT NULL DEFAULT 0,
  max_amount integer NOT NULL DEFAULT 0,
  pack_slug text,
  asset_rarity text,
  weight integer NOT NULL DEFAULT 1,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spin_rewards TO authenticated, anon;
GRANT ALL ON public.spin_rewards TO service_role;
ALTER TABLE public.spin_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spin rewards readable" ON public.spin_rewards FOR SELECT USING (true);
CREATE POLICY "spin rewards admin" ON public.spin_rewards FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ ECONOMY MULTIPLIERS (CMS) ============
CREATE TABLE IF NOT EXISTS public.economy_multipliers (
  id integer PRIMARY KEY DEFAULT 1,
  production_multiplier numeric(6,3) NOT NULL DEFAULT 1.0,
  credits_multiplier numeric(6,3) NOT NULL DEFAULT 1.0,
  xp_multiplier numeric(6,3) NOT NULL DEFAULT 1.0,
  energy_production_multiplier numeric(6,3) NOT NULL DEFAULT 1.0,
  spin_multiplier numeric(6,3) NOT NULL DEFAULT 1.0,
  max_offline_hours integer NOT NULL DEFAULT 24,
  CONSTRAINT singleton CHECK (id = 1)
);
GRANT SELECT ON public.economy_multipliers TO authenticated, anon;
GRANT ALL ON public.economy_multipliers TO service_role;
ALTER TABLE public.economy_multipliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mult readable" ON public.economy_multipliers FOR SELECT USING (true);
CREATE POLICY "mult admin" ON public.economy_multipliers FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.economy_multipliers (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ Seed default spin rewards ============
INSERT INTO public.spin_rewards (label, kind, min_amount, max_amount, weight, icon, sort_order) VALUES
('50 Credits','credits',50,50,30,'💰',1),
('200 Credits','credits',200,200,15,'💰',2),
('1000 Credits','credits',1000,1000,3,'💰',3),
('25 Energy','energy',25,25,20,'⚡',4),
('100 XP','xp',100,100,15,'✨',5),
('Bronze Pack','pack',1,1,10,'📦',6),
('Silver Pack','pack',1,1,5,'📦',7),
('Random Rare Asset','asset',1,1,2,'💎',8)
ON CONFLICT DO NOTHING;
UPDATE public.spin_rewards SET pack_slug='bronze' WHERE label='Bronze Pack';
UPDATE public.spin_rewards SET pack_slug='silver' WHERE label='Silver Pack';
UPDATE public.spin_rewards SET asset_rarity='rare' WHERE label='Random Rare Asset';

-- ============ Seed production rates for existing assets by rarity ============
UPDATE public.assets SET
  energy_per_hour = CASE rarity::text
    WHEN 'common' THEN 0.5 WHEN 'uncommon' THEN 1 WHEN 'rare' THEN 2
    WHEN 'epic' THEN 4 WHEN 'legendary' THEN 8 ELSE 0 END,
  credits_per_hour = CASE rarity::text
    WHEN 'common' THEN 5 WHEN 'uncommon' THEN 12 WHEN 'rare' THEN 30
    WHEN 'epic' THEN 75 WHEN 'legendary' THEN 200 ELSE 0 END,
  xp_per_hour = CASE rarity::text
    WHEN 'common' THEN 1 WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 5
    WHEN 'epic' THEN 12 WHEN 'legendary' THEN 30 ELSE 0 END
WHERE energy_per_hour = 0 AND credits_per_hour = 0;

-- ============ collect_production RPC ============
CREATE OR REPLACE FUNCTION public.collect_production(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mult public.economy_multipliers;
  cfg public.game_settings;
  s public.user_stats;
  hours numeric;
  total_credits numeric := 0;
  total_xp numeric := 0;
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
    COALESCE(SUM(a.xp_per_hour * ui.quantity),0),
    COALESCE(SUM(a.energy_per_hour * ui.quantity),0)
  INTO total_credits, total_xp, total_energy
  FROM public.user_inventory ui
  JOIN public.assets a ON a.id = ui.asset_id
  WHERE ui.user_id = p_user;

  total_credits := floor(total_credits * hours * mult.production_multiplier * mult.credits_multiplier);
  total_xp := floor(total_xp * hours * mult.production_multiplier * mult.xp_multiplier);
  total_energy := floor(total_energy * hours * mult.production_multiplier * mult.energy_production_multiplier);

  bonus_max := COALESCE(s.bonus_energy_max,0);
  UPDATE public.user_stats SET
    credits = credits + total_credits::int,
    xp = xp + total_xp::int,
    level = GREATEST(1, ((xp + total_xp::int) / cfg.xp_per_level) + 1),
    energy = LEAST(cfg.energy_max + bonus_max, energy + total_energy::int),
    production_collected_at = now()
  WHERE user_id = p_user;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES
    (p_user, 'collect_production', jsonb_build_object('credits',total_credits,'xp',total_xp,'energy',total_energy,'hours',hours));

  RETURN jsonb_build_object('credits',total_credits,'xp',total_xp,'energy',total_energy,'hours',hours);
END $$;

-- ============ claim_collection_bonus RPC ============
CREATE OR REPLACE FUNCTION public.claim_collection_bonus(p_user uuid, p_collection_id uuid, p_threshold int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_assets int;
  owned int;
  pct numeric;
  bonus jsonb;
  spin_amt int := 0;
  energy_bonus int := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user THEN RAISE EXCEPTION 'forbidden'; END IF;
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
    UPDATE public.user_stats SET bonus_energy_max = bonus_energy_max + energy_bonus, spin_tokens = spin_tokens + spin_amt WHERE user_id = p_user;
  ELSIF bonus->>'type' = 'realm_unlock' THEN
    UPDATE public.user_stats SET spin_tokens = spin_tokens + spin_amt, collections_completed = collections_completed + 1 WHERE user_id = p_user;
  ELSE
    UPDATE public.user_stats SET spin_tokens = spin_tokens + spin_amt WHERE user_id = p_user;
  END IF;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES (p_user,'claim_bonus',jsonb_build_object('collection_id',p_collection_id,'threshold',p_threshold,'bonus',bonus));
  RETURN jsonb_build_object('ok',true,'bonus',bonus);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('error','already_claimed');
END $$;

-- ============ spin_wheel RPC ============
CREATE OR REPLACE FUNCTION public.spin_wheel(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    WHEN 'xp' THEN
      amount := floor(amount * mult.spin_multiplier * mult.xp_multiplier)::int;
      UPDATE public.user_stats SET xp = xp + amount, level = GREATEST(1, ((xp + amount) / cfg.xp_per_level) + 1) WHERE user_id = p_user;
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
  END CASE;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES (p_user,'spin',jsonb_build_object('reward',row_to_json(chosen),'amount',amount));
  RETURN jsonb_build_object('reward',row_to_json(chosen),'amount',amount,'asset',row_to_json(asset_row),'pack',row_to_json(pack_row));
END $$;
