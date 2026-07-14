
-- Source types (extensible)
CREATE TABLE public.loot_source_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  color text,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loot_source_types TO authenticated;
GRANT ALL ON public.loot_source_types TO service_role;
ALTER TABLE public.loot_source_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read loot_source_types" ON public.loot_source_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin loot_source_types" ON public.loot_source_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Loot tables
CREATE TABLE public.loot_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  internal_id text,
  name text NOT NULL,
  description text,
  category text,
  source_type_id uuid REFERENCES public.loot_source_types(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  tags text[] NOT NULL DEFAULT '{}',
  min_rewards int NOT NULL DEFAULT 1,
  max_rewards int NOT NULL DEFAULT 1,
  allow_duplicates boolean NOT NULL DEFAULT false,
  guaranteed_first boolean NOT NULL DEFAULT true,
  weighted_random boolean NOT NULL DEFAULT true,
  total_rolls bigint NOT NULL DEFAULT 0,
  total_rewards_granted bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loot_tables TO authenticated;
GRANT ALL ON public.loot_tables TO service_role;
ALTER TABLE public.loot_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read loot_tables" ON public.loot_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin loot_tables" ON public.loot_tables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_loot_tables_updated BEFORE UPDATE ON public.loot_tables
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Loot entries
CREATE TABLE public.loot_table_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loot_table_id uuid NOT NULL REFERENCES public.loot_tables(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  weight int NOT NULL DEFAULT 1,
  drop_chance numeric(6,3) NOT NULL DEFAULT 0,
  min_quantity int NOT NULL DEFAULT 1,
  max_quantity int NOT NULL DEFAULT 1,
  guaranteed boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  times_awarded bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lte_table ON public.loot_table_entries(loot_table_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loot_table_entries TO authenticated;
GRANT ALL ON public.loot_table_entries TO service_role;
ALTER TABLE public.loot_table_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read loot_table_entries" ON public.loot_table_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin loot_table_entries" ON public.loot_table_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- References (demo)
CREATE TABLE public.loot_table_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loot_table_id uuid NOT NULL REFERENCES public.loot_tables(id) ON DELETE CASCADE,
  module text NOT NULL,
  record_name text NOT NULL,
  record_ref text,
  status text NOT NULL DEFAULT 'active',
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ltr_table ON public.loot_table_references(loot_table_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loot_table_references TO authenticated;
GRANT ALL ON public.loot_table_references TO service_role;
ALTER TABLE public.loot_table_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read loot_table_references" ON public.loot_table_references FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin loot_table_references" ON public.loot_table_references FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Activity log
CREATE TABLE public.loot_table_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loot_table_id uuid NOT NULL REFERENCES public.loot_tables(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid,
  actor_label text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ltal_table ON public.loot_table_activity_log(loot_table_id, created_at DESC);
GRANT SELECT, INSERT ON public.loot_table_activity_log TO authenticated;
GRANT ALL ON public.loot_table_activity_log TO service_role;
ALTER TABLE public.loot_table_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read loot_table_activity_log" ON public.loot_table_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert loot_table_activity_log" ON public.loot_table_activity_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Audit trigger
CREATE OR REPLACE FUNCTION public.trg_loot_table_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.loot_table_activity_log(loot_table_id, action, actor_id, detail)
    VALUES (NEW.id, 'created', v_actor, jsonb_build_object('name', NEW.name));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.enabled IS DISTINCT FROM OLD.enabled THEN
      INSERT INTO public.loot_table_activity_log(loot_table_id, action, actor_id, detail)
      VALUES (NEW.id, CASE WHEN NEW.enabled THEN 'enabled' ELSE 'disabled' END, v_actor, '{}'::jsonb);
    ELSE
      INSERT INTO public.loot_table_activity_log(loot_table_id, action, actor_id, detail)
      VALUES (NEW.id, 'updated', v_actor, '{}'::jsonb);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_loot_tables_audit AFTER INSERT OR UPDATE ON public.loot_tables
  FOR EACH ROW EXECUTE FUNCTION public.trg_loot_table_audit();

CREATE OR REPLACE FUNCTION public.trg_loot_entry_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_tbl uuid;
BEGIN
  v_tbl := COALESCE(NEW.loot_table_id, OLD.loot_table_id);
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.loot_table_activity_log(loot_table_id, action, actor_id, detail)
    VALUES (v_tbl, 'entry_added', v_actor, jsonb_build_object('reward_id', NEW.reward_id, 'weight', NEW.weight));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.loot_table_activity_log(loot_table_id, action, actor_id, detail)
    VALUES (v_tbl, 'entry_removed', v_actor, jsonb_build_object('reward_id', OLD.reward_id));
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_loot_entries_audit AFTER INSERT OR DELETE ON public.loot_table_entries
  FOR EACH ROW EXECUTE FUNCTION public.trg_loot_entry_audit();

-- Seed source types
INSERT INTO public.loot_source_types (slug, name, icon, sort_order, is_system) VALUES
  ('mining','Mining','Pickaxe',10,true),
  ('woodcutting','Woodcutting','TreePine',20,true),
  ('fishing','Fishing','Fish',30,true),
  ('farming','Farming','Wheat',40,true),
  ('crafting','Crafting','Hammer',50,true),
  ('quests','Quests','ScrollText',60,true),
  ('achievements','Achievements','Trophy',70,true),
  ('daily_login','Daily Login','CalendarCheck',80,true),
  ('events','Events','Sparkles',90,true),
  ('battle_pass','Battle Pass','Shield',100,true),
  ('chests','Chests','Package',110,true),
  ('bosses','Bosses','Skull',120,true),
  ('collections','Collections','Layers',130,true),
  ('guilds','Guilds','Users',140,true),
  ('mini_games','Mini-games','Gamepad2',150,true),
  ('seasonal','Seasonal','Snowflake',160,true),
  ('admin','Admin','Wrench',170,true);
