
-- =========== ENUMS ===========
CREATE TYPE public.rarity AS ENUM ('common','rare','epic','legendary');
CREATE TYPE public.tile_reward_type AS ENUM ('credits','xp','asset','pack','empty');

-- =========== CONTENT ===========
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  reward_credits int NOT NULL DEFAULT 1000,
  reward_xp int NOT NULL DEFAULT 500,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collections TO authenticated, anon;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections readable" ON public.collections FOR SELECT USING (true);

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  rarity public.rarity NOT NULL DEFAULT 'common',
  collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assets TO authenticated, anon;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets readable" ON public.assets FOR SELECT USING (true);
CREATE INDEX idx_assets_collection ON public.assets(collection_id);

CREATE TABLE public.packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  tier text NOT NULL DEFAULT 'bronze', -- bronze/silver/gold/legendary
  price_credits int NOT NULL DEFAULT 100,
  assets_per_pack int NOT NULL DEFAULT 3,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packs TO authenticated, anon;
GRANT ALL ON public.packs TO service_role;
ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packs readable" ON public.packs FOR SELECT USING (true);

CREATE TABLE public.pack_drop_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  rarity public.rarity NOT NULL,
  weight int NOT NULL CHECK (weight >= 0),
  UNIQUE(pack_id, rarity)
);
GRANT SELECT ON public.pack_drop_rates TO authenticated, anon;
GRANT ALL ON public.pack_drop_rates TO service_role;
ALTER TABLE public.pack_drop_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drop rates readable" ON public.pack_drop_rates FOR SELECT USING (true);

CREATE TABLE public.game_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  energy_max int NOT NULL DEFAULT 100,
  energy_regen_seconds int NOT NULL DEFAULT 180, -- 1 energy per N seconds
  dig_energy_cost int NOT NULL DEFAULT 1,
  grid_size int NOT NULL DEFAULT 5,
  xp_per_level int NOT NULL DEFAULT 500,
  treasure_rewards jsonb NOT NULL DEFAULT '[
    {"type":"empty","weight":40},
    {"type":"credits","weight":30,"min":10,"max":80},
    {"type":"xp","weight":15,"min":10,"max":50},
    {"type":"asset","weight":10,"rarity_weights":{"common":70,"rare":25,"epic":5}},
    {"type":"pack","weight":5,"pack_slug":"bronze"}
  ]'::jsonb
);
GRANT SELECT ON public.game_settings TO authenticated, anon;
GRANT ALL ON public.game_settings TO service_role;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.game_settings FOR SELECT USING (true);
INSERT INTO public.game_settings (id) VALUES (1);

-- =========== USER DATA ===========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits int NOT NULL DEFAULT 500,
  xp int NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 1,
  energy int NOT NULL DEFAULT 50,
  energy_updated_at timestamptz NOT NULL DEFAULT now(),
  packs_opened int NOT NULL DEFAULT 0,
  collections_completed int NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_stats TO authenticated;
GRANT ALL ON public.user_stats TO service_role;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stats read" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.user_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  first_obtained_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, asset_id)
);
GRANT SELECT ON public.user_inventory TO authenticated;
GRANT ALL ON public.user_inventory TO service_role;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own inv read" ON public.user_inventory FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX idx_inv_user ON public.user_inventory(user_id);

CREATE TABLE public.user_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  UNIQUE(user_id, pack_id)
);
GRANT SELECT ON public.user_packs TO authenticated;
GRANT ALL ON public.user_packs TO service_role;
ALTER TABLE public.user_packs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own packs read" ON public.user_packs FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL, -- 'dig','open_pack','collection_complete'
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activity read" ON public.activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX idx_activity_user_time ON public.activity_log(user_id, created_at DESC);

-- =========== SIGNUP TRIGGER ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== ENERGY REGEN HELPER ===========
CREATE OR REPLACE FUNCTION public.apply_energy_regen(p_user uuid)
RETURNS public.user_stats LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.user_stats;
  cfg public.game_settings;
  elapsed int;
  gained int;
BEGIN
  SELECT * INTO cfg FROM public.game_settings WHERE id = 1;
  SELECT * INTO s FROM public.user_stats WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.user_stats (user_id) VALUES (p_user) RETURNING * INTO s;
  END IF;
  elapsed := GREATEST(0, EXTRACT(EPOCH FROM (now() - s.energy_updated_at))::int);
  gained := elapsed / cfg.energy_regen_seconds;
  IF gained > 0 AND s.energy < cfg.energy_max THEN
    s.energy := LEAST(cfg.energy_max, s.energy + gained);
    s.energy_updated_at := s.energy_updated_at + make_interval(secs => gained * cfg.energy_regen_seconds);
    UPDATE public.user_stats SET energy = s.energy, energy_updated_at = s.energy_updated_at WHERE user_id = p_user;
  END IF;
  RETURN s;
END $$;

-- =========== DIG TILE ===========
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

  -- deduct energy
  UPDATE public.user_stats SET energy = energy - cfg.dig_energy_cost WHERE user_id = p_user;

  CASE chosen->>'type'
    WHEN 'empty' THEN
      result := jsonb_build_object('type','empty');
    WHEN 'credits' THEN
      credits_amt := floor(random() * ((chosen->>'max')::int - (chosen->>'min')::int + 1) + (chosen->>'min')::int)::int;
      UPDATE public.user_stats SET credits = credits + credits_amt WHERE user_id = p_user;
      result := jsonb_build_object('type','credits','amount',credits_amt);
    WHEN 'xp' THEN
      xp_amt := floor(random() * ((chosen->>'max')::int - (chosen->>'min')::int + 1) + (chosen->>'min')::int)::int;
      UPDATE public.user_stats SET xp = xp + xp_amt, level = GREATEST(1, ((xp + xp_amt) / cfg.xp_per_level) + 1) WHERE user_id = p_user;
      result := jsonb_build_object('type','xp','amount',xp_amt);
    WHEN 'asset' THEN
      -- pick rarity
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
        INSERT INTO public.user_inventory (user_id, asset_id, quantity)
        VALUES (p_user, asset_row.id, 1)
        ON CONFLICT (user_id, asset_id) DO UPDATE SET quantity = public.user_inventory.quantity + 1;
        result := jsonb_build_object('type','asset','asset', to_jsonb(asset_row));
      ELSE
        result := jsonb_build_object('type','empty');
      END IF;
    WHEN 'pack' THEN
      SELECT * INTO pack_row FROM public.packs WHERE slug = chosen->>'pack_slug' LIMIT 1;
      IF FOUND THEN
        INSERT INTO public.user_packs (user_id, pack_id, quantity)
        VALUES (p_user, pack_row.id, 1)
        ON CONFLICT (user_id, pack_id) DO UPDATE SET quantity = public.user_packs.quantity + 1;
        result := jsonb_build_object('type','pack','pack', to_jsonb(pack_row));
      END IF;
  END CASE;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES (p_user, 'dig', result);
  RETURN result;
END $$;

-- =========== OPEN PACK ===========
CREATE OR REPLACE FUNCTION public.open_pack(p_user uuid, p_pack_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.user_stats;
  cfg public.game_settings;
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
  SELECT * INTO cfg FROM public.game_settings WHERE id = 1;
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
      INSERT INTO public.user_inventory (user_id, asset_id, quantity)
      VALUES (p_user, asset_row.id, 1)
      ON CONFLICT (user_id, asset_id) DO UPDATE SET quantity = public.user_inventory.quantity + 1;
      drops := drops || to_jsonb(asset_row);
    END IF;
  END LOOP;

  INSERT INTO public.activity_log (user_id, kind, payload) VALUES (p_user, 'open_pack', jsonb_build_object('pack', to_jsonb(pack_row), 'drops', drops));
  RETURN jsonb_build_object('pack', to_jsonb(pack_row), 'drops', drops);
END $$;

-- =========== SEED CONTENT ===========
INSERT INTO public.collections (slug, name, description, reward_credits, reward_xp, sort_order) VALUES
('peterhead', 'Peterhead Harbour', 'Iconic landmarks and vessels of Peterhead.', 2000, 800, 1),
('scotland', 'Scottish Heritage', 'Treasures from across the Scottish coast.', 3000, 1200, 2);

WITH c AS (SELECT id, slug FROM public.collections)
INSERT INTO public.assets (slug, name, description, rarity, collection_id, sort_order) VALUES
('lighthouse','Buchan Ness Lighthouse','A guiding beacon on the rocky coast.','rare', (SELECT id FROM c WHERE slug='peterhead'), 1),
('fishing-boat','Fishing Boat','Workhorse of the northern fleet.','common', (SELECT id FROM c WHERE slug='peterhead'), 2),
('harbour-crane','Harbour Crane','Heavy iron arm of the port.','epic', (SELECT id FROM c WHERE slug='peterhead'), 3),
('seagull','Harbour Seagull','Sharp eyes, sharper appetite.','common', (SELECT id FROM c WHERE slug='peterhead'), 4),
('lobster-pot','Lobster Pot','Hand-woven creel from the docks.','common', (SELECT id FROM c WHERE slug='peterhead'), 5),
('trawler','North Sea Trawler','Battered, salt-bleached, legendary.','epic', (SELECT id FROM c WHERE slug='peterhead'), 6),
('compass','Brass Compass','Always points to the next adventure.','rare', (SELECT id FROM c WHERE slug='peterhead'), 7),
('captain','Captain MacLeod','A legend among the fleet.','legendary', (SELECT id FROM c WHERE slug='peterhead'), 8),
('highland-cow','Highland Cow','Stoic and shaggy.','common', (SELECT id FROM c WHERE slug='scotland'), 1),
('thistle','Royal Thistle','The emblem of the realm.','rare', (SELECT id FROM c WHERE slug='scotland'), 2),
('castle','Dunnottar Castle','Cliffside fortress wreathed in mist.','epic', (SELECT id FROM c WHERE slug='scotland'), 3),
('claymore','The Claymore','Two-handed blade of kings.','legendary', (SELECT id FROM c WHERE slug='scotland'), 4);

INSERT INTO public.packs (slug, name, description, tier, price_credits, assets_per_pack, sort_order) VALUES
('bronze','Bronze Pack','3 assets. Mostly Common with a chance at Rare.','bronze',100,3,1),
('silver','Silver Pack','3 assets. Better odds for Rare and Epic.','silver',500,3,2),
('gold','Gold Pack','3 assets. Strong chance at Epic, a shot at Legendary.','gold',1000,3,3);

WITH p AS (SELECT id, slug FROM public.packs)
INSERT INTO public.pack_drop_rates (pack_id, rarity, weight) VALUES
((SELECT id FROM p WHERE slug='bronze'),'common',75),
((SELECT id FROM p WHERE slug='bronze'),'rare',22),
((SELECT id FROM p WHERE slug='bronze'),'epic',3),
((SELECT id FROM p WHERE slug='bronze'),'legendary',0),
((SELECT id FROM p WHERE slug='silver'),'common',40),
((SELECT id FROM p WHERE slug='silver'),'rare',40),
((SELECT id FROM p WHERE slug='silver'),'epic',18),
((SELECT id FROM p WHERE slug='silver'),'legendary',2),
((SELECT id FROM p WHERE slug='gold'),'common',15),
((SELECT id FROM p WHERE slug='gold'),'rare',40),
((SELECT id FROM p WHERE slug='gold'),'epic',35),
((SELECT id FROM p WHERE slug='gold'),'legendary',10);
