
-- Extend reward_types
ALTER TABLE public.reward_types
  ADD COLUMN IF NOT EXISTS internal_id text,
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#8B5CF6',
  ADD COLUMN IF NOT EXISTS stackable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tradable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

UPDATE public.reward_types SET internal_id = slug WHERE internal_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reward_types_internal_id_key ON public.reward_types(internal_id);

-- Rewards library
CREATE TABLE IF NOT EXISTS public.rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  reward_type_id uuid NOT NULL REFERENCES public.reward_types(id) ON DELETE RESTRICT,
  description text,
  icon text,
  quantity integer NOT NULL DEFAULT 1,
  rarity text NOT NULL DEFAULT 'common',
  enabled boolean NOT NULL DEFAULT true,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rewards_read" ON public.rewards FOR SELECT USING (true);
CREATE POLICY "rewards_admin" ON public.rewards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS rewards_type_idx ON public.rewards(reward_type_id);
CREATE INDEX IF NOT EXISTS rewards_enabled_idx ON public.rewards(enabled);
CREATE INDEX IF NOT EXISTS rewards_tags_idx ON public.rewards USING gin(tags);

CREATE OR REPLACE FUNCTION public.rewards_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_rewards_touch ON public.rewards;
CREATE TRIGGER trg_rewards_touch BEFORE UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.rewards_touch_updated_at();

-- Seed 14 reward types (idempotent)
INSERT INTO public.reward_types (slug, name, kind, icon, description, sort_order, internal_id, color, stackable, tradable, enabled) VALUES
  ('xp','XP','xp','Hexagon','Experience points',10,'xp','#F59E0B',true,false,true),
  ('gold','Gold','credits','Coins','Primary currency',20,'gold','#EAB308',true,true,true),
  ('gems','Gems','credits','Gem','Premium currency',30,'gems','#06B6D4',true,true,true),
  ('energy','Energy','energy','Zap','Action fuel',40,'energy','#22C55E',true,false,true),
  ('item','Item','asset','Package','General items',50,'item','#94A3B8',true,true,true),
  ('equipment','Equipment','asset','Sword','Wearable gear',60,'equipment','#A855F7',false,true,true),
  ('resource','Resource','asset','Boxes','Crafting materials',70,'resource','#84CC16',true,true,true),
  ('collection_piece','Collection Piece','asset','Puzzle','Collectible fragment',80,'collection_piece','#EC4899',true,true,true),
  ('cosmetic','Cosmetic','asset','Sparkles','Visual flair',90,'cosmetic','#F472B6',false,true,true),
  ('title','Title','unlock','BadgeCheck','Player title',100,'title','#0EA5E9',false,false,true),
  ('badge','Badge','unlock','Award','Profile badge',110,'badge','#F97316',false,false,true),
  ('chest','Chest','pack','Box','Loot container',120,'chest','#B45309',true,true,true),
  ('key','Key','asset','Key','Unlocks chests/doors',130,'key','#FBBF24',true,true,true),
  ('token','Token','credits','Circle','Event token',140,'token','#8B5CF6',true,true,true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  internal_id = EXCLUDED.internal_id,
  description = EXCLUDED.description;

-- Seed ~50 rewards (only when empty)
DO $$
DECLARE
  t_xp uuid; t_gold uuid; t_gems uuid; t_energy uuid; t_item uuid;
  t_equip uuid; t_res uuid; t_coll uuid; t_cos uuid; t_title uuid;
  t_badge uuid; t_chest uuid; t_key uuid; t_token uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.rewards LIMIT 1) THEN RETURN; END IF;
  SELECT id INTO t_xp FROM public.reward_types WHERE slug='xp';
  SELECT id INTO t_gold FROM public.reward_types WHERE slug='gold';
  SELECT id INTO t_gems FROM public.reward_types WHERE slug='gems';
  SELECT id INTO t_energy FROM public.reward_types WHERE slug='energy';
  SELECT id INTO t_item FROM public.reward_types WHERE slug='item';
  SELECT id INTO t_equip FROM public.reward_types WHERE slug='equipment';
  SELECT id INTO t_res FROM public.reward_types WHERE slug='resource';
  SELECT id INTO t_coll FROM public.reward_types WHERE slug='collection_piece';
  SELECT id INTO t_cos FROM public.reward_types WHERE slug='cosmetic';
  SELECT id INTO t_title FROM public.reward_types WHERE slug='title';
  SELECT id INTO t_badge FROM public.reward_types WHERE slug='badge';
  SELECT id INTO t_chest FROM public.reward_types WHERE slug='chest';
  SELECT id INTO t_key FROM public.reward_types WHERE slug='key';
  SELECT id INTO t_token FROM public.reward_types WHERE slug='token';

  INSERT INTO public.rewards (name, reward_type_id, description, icon, quantity, rarity, enabled, tags) VALUES
    ('Small XP Boost', t_xp, 'A small burst of experience', 'Hexagon', 50, 'common', true, ARRAY['daily','starter']),
    ('Medium XP Boost', t_xp, 'Solid XP reward', 'Hexagon', 250, 'uncommon', true, ARRAY['quest']),
    ('Large XP Boost', t_xp, 'Big XP payout', 'Hexagon', 1000, 'rare', true, ARRAY['quest','event']),
    ('Massive XP Cache', t_xp, 'Endgame XP payout', 'Hexagon', 5000, 'epic', true, ARRAY['endgame']),
    ('Legendary XP Surge', t_xp, 'For veterans only', 'Hexagon', 25000, 'legendary', true, ARRAY['endgame']),

    ('Copper Pouch', t_gold, 'A handful of gold', 'Coins', 100, 'common', true, ARRAY['daily']),
    ('Silver Purse', t_gold, 'A sturdy purse', 'Coins', 500, 'uncommon', true, ARRAY['quest']),
    ('Golden Chest', t_gold, 'Heavy with coin', 'Coins', 2500, 'rare', true, ARRAY['event']),
    ('Royal Treasury', t_gold, 'A king''s ransom', 'Coins', 10000, 'epic', true, ARRAY['endgame']),
    ('Dragon Hoard', t_gold, 'Legendary trove', 'Coins', 50000, 'legendary', true, ARRAY['endgame']),

    ('Gem Shard', t_gems, 'Tiny premium bonus', 'Gem', 5, 'common', true, ARRAY['daily']),
    ('Gem Cluster', t_gems, 'A pocket of gems', 'Gem', 25, 'uncommon', true, ARRAY['event']),
    ('Gem Vault', t_gems, 'Premium reward', 'Gem', 100, 'rare', true, ARRAY['event','endgame']),
    ('Gem Cascade', t_gems, 'A pile of premium currency', 'Gem', 500, 'legendary', true, ARRAY['endgame']),

    ('Energy Snack', t_energy, 'Restores some energy', 'Zap', 10, 'common', true, ARRAY['daily']),
    ('Energy Meal', t_energy, 'Full energy meal', 'Zap', 50, 'uncommon', true, ARRAY['quest']),
    ('Energy Feast', t_energy, 'Fills the bar', 'Zap', 200, 'rare', true, ARRAY['event']),

    ('Health Potion', t_item, 'Restores HP', 'Package', 3, 'common', true, ARRAY['starter']),
    ('Mana Potion', t_item, 'Restores mana', 'Package', 3, 'common', true, ARRAY['starter']),
    ('Bomb', t_item, 'Explosive item', 'Package', 5, 'uncommon', true, ARRAY['quest']),
    ('Smoke Bomb', t_item, 'For escape', 'Package', 2, 'uncommon', true, ARRAY['quest']),
    ('Mystery Box', t_item, 'Contains something random', 'Package', 1, 'rare', true, ARRAY['event']),

    ('Iron Sword', t_equip, 'Basic weapon', 'Sword', 1, 'common', true, ARRAY['starter']),
    ('Steel Shield', t_equip, 'Reliable defense', 'Sword', 1, 'uncommon', true, ARRAY['quest']),
    ('Enchanted Bow', t_equip, 'Magically infused', 'Sword', 1, 'rare', true, ARRAY['quest','event']),
    ('Dragonscale Armor', t_equip, 'Forged from scales', 'Sword', 1, 'epic', true, ARRAY['endgame']),
    ('Blade of Kings', t_equip, 'Legendary weapon', 'Sword', 1, 'legendary', true, ARRAY['endgame']),

    ('Wood', t_res, 'Basic crafting material', 'Boxes', 25, 'common', true, ARRAY['gathering']),
    ('Stone', t_res, 'Basic crafting material', 'Boxes', 25, 'common', true, ARRAY['gathering']),
    ('Iron Ore', t_res, 'Uncommon material', 'Boxes', 15, 'uncommon', true, ARRAY['gathering']),
    ('Mythril', t_res, 'Rare metal', 'Boxes', 5, 'rare', true, ARRAY['gathering','endgame']),
    ('Starforged Ingot', t_res, 'Epic material', 'Boxes', 1, 'epic', true, ARRAY['endgame']),

    ('Forest Fragment', t_coll, 'Piece of the Forest set', 'Puzzle', 1, 'uncommon', true, ARRAY['collection']),
    ('Ocean Fragment', t_coll, 'Piece of the Ocean set', 'Puzzle', 1, 'uncommon', true, ARRAY['collection']),
    ('Mountain Fragment', t_coll, 'Piece of the Mountain set', 'Puzzle', 1, 'rare', true, ARRAY['collection']),
    ('Celestial Fragment', t_coll, 'Rare cosmic fragment', 'Puzzle', 1, 'epic', true, ARRAY['collection','endgame']),

    ('Sparkling Aura', t_cos, 'Cosmetic effect', 'Sparkles', 1, 'rare', true, ARRAY['cosmetic']),
    ('Golden Nameplate', t_cos, 'Show off with gold', 'Sparkles', 1, 'epic', true, ARRAY['cosmetic']),
    ('Rainbow Trail', t_cos, 'Leaves a trail', 'Sparkles', 1, 'legendary', true, ARRAY['cosmetic','endgame']),

    ('Novice Title', t_title, 'Title: Novice', 'BadgeCheck', 1, 'common', true, ARRAY['title']),
    ('Champion Title', t_title, 'Title: Champion', 'BadgeCheck', 1, 'rare', true, ARRAY['title']),
    ('Ascendant Title', t_title, 'Title: Ascendant', 'BadgeCheck', 1, 'legendary', true, ARRAY['title','endgame']),

    ('First Steps Badge', t_badge, 'Badge for onboarding', 'Award', 1, 'common', true, ARRAY['badge','starter']),
    ('Event Attendee Badge', t_badge, 'Attended an event', 'Award', 1, 'uncommon', true, ARRAY['badge','event']),
    ('Season Winner Badge', t_badge, 'Won a season', 'Award', 1, 'legendary', true, ARRAY['badge','endgame']),

    ('Wooden Chest', t_chest, 'Contains basic loot', 'Box', 1, 'common', true, ARRAY['chest']),
    ('Iron Chest', t_chest, 'Contains uncommon loot', 'Box', 1, 'uncommon', true, ARRAY['chest']),
    ('Gold Chest', t_chest, 'Contains rare loot', 'Box', 1, 'rare', true, ARRAY['chest','event']),
    ('Mythic Chest', t_chest, 'Contains epic loot', 'Box', 1, 'epic', true, ARRAY['chest','endgame']),

    ('Bronze Key', t_key, 'Opens wooden chests', 'Key', 3, 'common', true, ARRAY['key']),
    ('Silver Key', t_key, 'Opens iron chests', 'Key', 2, 'uncommon', true, ARRAY['key']),
    ('Gold Key', t_key, 'Opens gold chests', 'Key', 1, 'rare', true, ARRAY['key','event']),

    ('Event Token', t_token, 'Redeemable event currency', 'Circle', 10, 'uncommon', true, ARRAY['event']),
    ('Festival Token', t_token, 'Seasonal currency', 'Circle', 25, 'rare', true, ARRAY['event','seasonal']);
END $$;
