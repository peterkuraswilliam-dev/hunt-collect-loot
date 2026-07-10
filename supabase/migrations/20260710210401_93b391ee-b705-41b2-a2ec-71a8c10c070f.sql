
-- Extend reward_bundles
ALTER TABLE public.reward_bundles
  ADD COLUMN IF NOT EXISTS internal_id text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS estimated_value integer NOT NULL DEFAULT 0;

UPDATE public.reward_bundles SET internal_id = slug WHERE internal_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reward_bundles_internal_id_key ON public.reward_bundles(internal_id);
CREATE INDEX IF NOT EXISTS reward_bundles_category_idx ON public.reward_bundles(category);
CREATE INDEX IF NOT EXISTS reward_bundles_enabled_idx ON public.reward_bundles(enabled);
CREATE INDEX IF NOT EXISTS reward_bundles_tags_idx ON public.reward_bundles USING gin(tags);

-- Items table
CREATE TABLE IF NOT EXISTS public.reward_bundle_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id uuid NOT NULL REFERENCES public.reward_bundles(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,
  quantity_override integer,
  guaranteed boolean NOT NULL DEFAULT true,
  weight integer NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_bundle_items TO authenticated;
GRANT ALL ON public.reward_bundle_items TO service_role;

ALTER TABLE public.reward_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rbi_read" ON public.reward_bundle_items FOR SELECT USING (true);
CREATE POLICY "rbi_admin" ON public.reward_bundle_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS rbi_bundle_idx ON public.reward_bundle_items(bundle_id, display_order);
CREATE INDEX IF NOT EXISTS rbi_reward_idx ON public.reward_bundle_items(reward_id);

-- Bundle categories (simple lookup)
CREATE TABLE IF NOT EXISTS public.reward_bundle_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_bundle_categories TO authenticated;
GRANT ALL ON public.reward_bundle_categories TO service_role;

ALTER TABLE public.reward_bundle_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rbc_read" ON public.reward_bundle_categories FOR SELECT USING (true);
CREATE POLICY "rbc_admin" ON public.reward_bundle_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.reward_bundle_categories (slug, name, icon, sort_order) VALUES
  ('level','Level Rewards','TrendingUp',10),
  ('quest','Quest Rewards','Scroll',20),
  ('achievement','Achievement Rewards','Trophy',30),
  ('daily_login','Daily Login','Calendar',40),
  ('event','Event Rewards','Sparkles',50),
  ('battle_pass','Battle Pass','Swords',60),
  ('profession','Profession Rewards','Hammer',70),
  ('collection','Collection Rewards','Puzzle',80),
  ('mining','Mining Rewards','Pickaxe',90),
  ('guild','Guild Rewards','Users',100),
  ('seasonal','Seasonal Rewards','Snowflake',110),
  ('admin','Admin Rewards','ShieldCheck',120)
ON CONFLICT (slug) DO NOTHING;

-- Touch trigger for bundles updated_at
CREATE OR REPLACE FUNCTION public.reward_bundles_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_reward_bundles_touch ON public.reward_bundles;
CREATE TRIGGER trg_reward_bundles_touch BEFORE UPDATE ON public.reward_bundles
  FOR EACH ROW EXECUTE FUNCTION public.reward_bundles_touch();

-- Seed ~30 demo bundles referencing existing rewards
DO $$
DECLARE
  b_id uuid;
  spec record;
  item_spec record;
  ord int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.reward_bundle_items LIMIT 1) THEN RETURN; END IF;

  FOR spec IN
    SELECT * FROM (VALUES
      ('starter_pack','Starter Pack','Everything a new player needs','Backpack','level',ARRAY['starter','onboarding']),
      ('welcome_bundle','Welcome Bundle','A warm welcome to new adventurers','Gift','level',ARRAY['starter']),
      ('level_5_rewards','Level 5 Rewards','Reward for reaching level 5','TrendingUp','level',ARRAY['level']),
      ('level_10_rewards','Level 10 Rewards','Reward for reaching level 10','TrendingUp','level',ARRAY['level']),
      ('level_25_rewards','Level 25 Rewards','Reward for reaching level 25','TrendingUp','level',ARRAY['level','endgame']),
      ('level_50_rewards','Level 50 Rewards','Reward for reaching level 50','TrendingUp','level',ARRAY['level','endgame']),
      ('bronze_mining_rewards','Bronze Mining Rewards','Basic mining loot','Pickaxe','mining',ARRAY['mining']),
      ('silver_mining_rewards','Silver Mining Rewards','Better mining loot','Pickaxe','mining',ARRAY['mining']),
      ('gold_mining_rewards','Gold Mining Rewards','Rich mining loot','Pickaxe','mining',ARRAY['mining','endgame']),
      ('daily_login_day_1','Daily Login Day 1','Day 1 login reward','Calendar','daily_login',ARRAY['daily']),
      ('daily_login_day_3','Daily Login Day 3','Day 3 login reward','Calendar','daily_login',ARRAY['daily']),
      ('daily_login_day_7','Daily Login Day 7','Weekly milestone login reward','Calendar','daily_login',ARRAY['daily','weekly']),
      ('daily_login_day_30','Daily Login Day 30','Monthly milestone login reward','Calendar','daily_login',ARRAY['daily','monthly']),
      ('quest_completion_pack','Quest Completion Pack','Standard quest payout','Scroll','quest',ARRAY['quest']),
      ('epic_quest_reward','Epic Quest Reward','Reward for epic quests','Scroll','quest',ARRAY['quest','endgame']),
      ('rare_chest','Rare Chest','Contents of a rare chest','Box','event',ARRAY['chest']),
      ('epic_chest','Epic Chest','Contents of an epic chest','Box','event',ARRAY['chest','endgame']),
      ('legendary_chest','Legendary Chest','Contents of a legendary chest','Box','event',ARRAY['chest','endgame']),
      ('collection_completion_reward','Collection Completion Reward','Payout for completing a collection','Puzzle','collection',ARRAY['collection']),
      ('collection_milestone_50','Collection Milestone 50%','Halfway there!','Puzzle','collection',ARRAY['collection']),
      ('first_kill_achievement','First Kill Achievement','Your first victory','Trophy','achievement',ARRAY['achievement']),
      ('boss_slayer_achievement','Boss Slayer Achievement','Defeat a boss','Trophy','achievement',ARRAY['achievement','endgame']),
      ('battle_pass_tier_10','Battle Pass Tier 10','Battle pass milestone','Swords','battle_pass',ARRAY['battle_pass']),
      ('battle_pass_tier_50','Battle Pass Tier 50','Battle pass milestone','Swords','battle_pass',ARRAY['battle_pass','endgame']),
      ('blacksmith_lvl_5','Blacksmith Level 5','Profession milestone','Hammer','profession',ARRAY['profession']),
      ('alchemist_lvl_10','Alchemist Level 10','Profession milestone','Hammer','profession',ARRAY['profession']),
      ('guild_weekly_reward','Guild Weekly Reward','Weekly guild contribution reward','Users','guild',ARRAY['guild','weekly']),
      ('guild_boss_kill','Guild Boss Kill','For downing the guild boss','Users','guild',ARRAY['guild','endgame']),
      ('winter_festival_gift','Winter Festival Gift','Seasonal celebration','Snowflake','seasonal',ARRAY['seasonal','event']),
      ('anniversary_bundle','Anniversary Bundle','Celebrate another year','Sparkles','seasonal',ARRAY['seasonal','anniversary']),
      ('admin_compensation_pack','Admin Compensation Pack','Given by admins to compensate players','ShieldCheck','admin',ARRAY['admin'])
    ) AS t(slug, name, description, icon, category, tags)
  LOOP
    INSERT INTO public.reward_bundles (slug, internal_id, name, description, icon, category, enabled, tags, status, rewards)
    VALUES (spec.slug, spec.slug, spec.name, spec.description, spec.icon, spec.category, true, spec.tags, 'active', '[]'::jsonb)
    ON CONFLICT (slug) DO UPDATE SET
      internal_id = EXCLUDED.internal_id,
      icon = EXCLUDED.icon,
      category = EXCLUDED.category,
      tags = EXCLUDED.tags,
      description = EXCLUDED.description
    RETURNING id INTO b_id;

    ord := 0;
    -- pick 2-4 relevant rewards based on category
    IF spec.category = 'mining' THEN
      FOR item_spec IN
        SELECT id, CASE WHEN spec.slug = 'gold_mining_rewards' THEN 3 WHEN spec.slug = 'silver_mining_rewards' THEN 2 ELSE 1 END AS boost
        FROM public.rewards WHERE 'gathering' = ANY(tags) LIMIT 3
      LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord);
        ord := ord + 1;
      END LOOP;
    ELSIF spec.category = 'chest' OR spec.slug LIKE '%chest%' THEN
      -- chests: guaranteed gold + random equipment/item
      FOR item_spec IN
        SELECT id, 1 AS boost FROM public.rewards
        WHERE name IN ('Silver Purse','Golden Chest','Royal Treasury','Dragon Hoard')
        LIMIT CASE WHEN spec.slug='legendary_chest' THEN 1 WHEN spec.slug='epic_chest' THEN 1 ELSE 1 END
      LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
      FOR item_spec IN
        SELECT id FROM public.rewards
        WHERE rarity IN ('rare','epic','legendary') AND name IN ('Enchanted Bow','Dragonscale Armor','Blade of Kings','Mystery Box','Mythic Chest')
        LIMIT 2
      LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, false, 5, ord); ord := ord + 1;
      END LOOP;
    ELSIF spec.category = 'daily_login' THEN
      FOR item_spec IN
        SELECT id FROM public.rewards WHERE name IN ('Copper Pouch','Energy Snack','Small XP Boost','Gem Shard') LIMIT 2
      LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
      IF spec.slug IN ('daily_login_day_7','daily_login_day_30') THEN
        FOR item_spec IN SELECT id FROM public.rewards WHERE name IN ('Gem Cluster','Wooden Chest','Bronze Key') LIMIT 2 LOOP
          INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
          VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
        END LOOP;
      END IF;
    ELSIF spec.category = 'level' THEN
      FOR item_spec IN
        SELECT id FROM public.rewards WHERE name IN ('Medium XP Boost','Silver Purse','Gem Cluster','Energy Meal') LIMIT 3
      LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
      IF spec.slug IN ('level_25_rewards','level_50_rewards') THEN
        FOR item_spec IN SELECT id FROM public.rewards WHERE name IN ('Enchanted Bow','Dragonscale Armor','Massive XP Cache') LIMIT 2 LOOP
          INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
          VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
        END LOOP;
      END IF;
    ELSIF spec.category = 'quest' THEN
      FOR item_spec IN SELECT id FROM public.rewards WHERE name IN ('Medium XP Boost','Silver Purse','Bomb') LIMIT 3 LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
    ELSIF spec.category = 'achievement' THEN
      FOR item_spec IN SELECT id FROM public.rewards WHERE name IN ('First Steps Badge','Champion Title','Sparkling Aura') LIMIT 2 LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
    ELSIF spec.category = 'battle_pass' THEN
      FOR item_spec IN SELECT id FROM public.rewards WHERE name IN ('Gem Cluster','Golden Nameplate','Event Token','Massive XP Cache') LIMIT 3 LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
    ELSIF spec.category = 'profession' THEN
      FOR item_spec IN SELECT id FROM public.rewards WHERE name IN ('Iron Ore','Wood','Medium XP Boost','Mythril') LIMIT 3 LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
    ELSIF spec.category = 'collection' THEN
      FOR item_spec IN SELECT id FROM public.rewards WHERE name IN ('Forest Fragment','Ocean Fragment','Mountain Fragment','Celestial Fragment','Golden Chest') LIMIT 3 LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
    ELSIF spec.category = 'guild' THEN
      FOR item_spec IN SELECT id FROM public.rewards WHERE name IN ('Golden Chest','Event Token','Champion Title','Gem Cluster') LIMIT 3 LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
    ELSIF spec.category = 'seasonal' THEN
      FOR item_spec IN SELECT id FROM public.rewards WHERE name IN ('Festival Token','Sparkling Aura','Gem Vault','Season Winner Badge') LIMIT 3 LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
    ELSIF spec.category = 'admin' THEN
      FOR item_spec IN SELECT id FROM public.rewards WHERE name IN ('Royal Treasury','Gem Vault','Massive XP Cache','Energy Feast') LIMIT 4 LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
    END IF;

    -- fallback: ensure at least 2 items
    IF ord < 2 THEN
      FOR item_spec IN SELECT id FROM public.rewards ORDER BY random() LIMIT 3 - ord LOOP
        INSERT INTO public.reward_bundle_items (bundle_id, reward_id, guaranteed, weight, display_order)
        VALUES (b_id, item_spec.id, true, 1, ord); ord := ord + 1;
      END LOOP;
    END IF;
  END LOOP;

  -- Compute estimated_value = sum(quantity * base value) using rough kind heuristic
  UPDATE public.reward_bundles rb SET estimated_value = COALESCE((
    SELECT SUM(COALESCE(rbi.quantity_override, r.quantity) *
      CASE rt.kind
        WHEN 'credits' THEN 1
        WHEN 'xp' THEN 2
        WHEN 'energy' THEN 5
        WHEN 'pack' THEN 500
        WHEN 'asset' THEN 50
        WHEN 'unlock' THEN 200
        ELSE 10
      END)::int
    FROM public.reward_bundle_items rbi
    JOIN public.rewards r ON r.id = rbi.reward_id
    JOIN public.reward_types rt ON rt.id = r.reward_type_id
    WHERE rbi.bundle_id = rb.id
  ), 0);
END $$;
