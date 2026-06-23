
-- ========== asset_types ==========
CREATE TABLE public.asset_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asset_types TO anon, authenticated;
GRANT ALL ON public.asset_types TO service_role;
ALTER TABLE public.asset_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_types read" ON public.asset_types FOR SELECT USING (true);
CREATE POLICY "asset_types admin write" ON public.asset_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.asset_types (slug,name,icon,sort_order,is_system) VALUES
  ('landmark','Landmark','MapPin',1,true),
  ('character','Character','User',2,true),
  ('vehicle','Vehicle','Car',3,true),
  ('building','Building','Building2',4,true),
  ('animal','Animal','PawPrint',5,true),
  ('product','Product','Package',6,true),
  ('business','Business','Briefcase',7,true),
  ('event','Event','Calendar',8,true);

-- ========== asset_rarities ==========
CREATE TABLE public.asset_rarities (
  slug text PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#888888',
  weight int NOT NULL DEFAULT 100,
  sort_order int NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.asset_rarities TO anon, authenticated;
GRANT ALL ON public.asset_rarities TO service_role;
ALTER TABLE public.asset_rarities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rarities read" ON public.asset_rarities FOR SELECT USING (true);
CREATE POLICY "rarities admin write" ON public.asset_rarities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.asset_rarities (slug,name,color,weight,sort_order,is_system) VALUES
  ('common','Common','#9ca3af',1000,1,true),
  ('rare','Rare','#3b82f6',300,2,true),
  ('epic','Epic','#a855f7',80,3,true),
  ('legendary','Legendary','#f59e0b',20,4,true);

-- ========== tags ==========
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  icon text,
  description text,
  parent_id uuid REFERENCES public.tags(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tags TO anon, authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tags read" ON public.tags FOR SELECT USING (true);
CREATE POLICY "tags admin write" ON public.tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== asset_tags ==========
CREATE TABLE public.asset_tags (
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, tag_id)
);
GRANT SELECT ON public.asset_tags TO anon, authenticated;
GRANT ALL ON public.asset_tags TO service_role;
ALTER TABLE public.asset_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset_tags read" ON public.asset_tags FOR SELECT USING (true);
CREATE POLICY "asset_tags admin write" ON public.asset_tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX asset_tags_tag_idx ON public.asset_tags(tag_id);

-- ========== automation_rules ==========
CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL DEFAULT 'assets',
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  trigger jsonb NOT NULL DEFAULT '{}'::jsonb,
  action jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules read auth" ON public.automation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "rules admin write" ON public.automation_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== module_settings ==========
CREATE TABLE public.module_settings (
  module text PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.module_settings TO authenticated;
GRANT ALL ON public.module_settings TO service_role;
ALTER TABLE public.module_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read auth" ON public.module_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.module_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.module_settings (module,settings) VALUES
  ('assets','{"default_status":"active","require_image":false,"auto_slug":true}'::jsonb);

-- ========== module_permissions ==========
CREATE TABLE public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  role public.app_role NOT NULL,
  capability text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, role, capability)
);
GRANT SELECT ON public.module_permissions TO authenticated;
GRANT ALL ON public.module_permissions TO service_role;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perms read auth" ON public.module_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "perms admin write" ON public.module_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.module_permissions (module,role,capability) VALUES
  ('assets','admin','view'),('assets','admin','manage'),('assets','admin','configure'),
  ('assets','business_owner','view'),('assets','business_owner','manage');

-- ========== extend assets ==========
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS asset_type_id uuid REFERENCES public.asset_types(id) ON DELETE SET NULL;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- ========== automation runner ==========
CREATE OR REPLACE FUNCTION public.apply_automation_rules(p_asset_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  asset_tag_ids uuid[];
  match_tags uuid[];
  match_mode text;
  action_type text;
  target_collection uuid;
  matched boolean;
BEGIN
  SELECT array_agg(tag_id) INTO asset_tag_ids FROM public.asset_tags WHERE asset_id = p_asset_id;
  asset_tag_ids := COALESCE(asset_tag_ids, ARRAY[]::uuid[]);

  FOR r IN SELECT * FROM public.automation_rules WHERE enabled = true AND module = 'assets' LOOP
    IF (r.trigger->>'event') <> 'asset_tagged' THEN CONTINUE; END IF;
    SELECT array_agg((x)::uuid) INTO match_tags FROM jsonb_array_elements_text(COALESCE(r.trigger->'match_tags','[]'::jsonb)) x;
    match_tags := COALESCE(match_tags, ARRAY[]::uuid[]);
    match_mode := COALESCE(r.trigger->>'match_mode','all');

    IF match_mode = 'all' THEN
      matched := match_tags <@ asset_tag_ids AND array_length(match_tags,1) IS NOT NULL;
    ELSE
      matched := match_tags && asset_tag_ids;
    END IF;
    IF NOT matched THEN CONTINUE; END IF;

    action_type := r.action->>'type';
    IF action_type = 'add_to_collection' THEN
      target_collection := (r.action->>'collection_id')::uuid;
      IF target_collection IS NOT NULL THEN
        UPDATE public.assets SET collection_id = target_collection WHERE id = p_asset_id AND (collection_id IS NULL OR collection_id <> target_collection);
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trg_asset_tags_apply_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.apply_automation_rules(COALESCE(NEW.asset_id, OLD.asset_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS asset_tags_rules_aiud ON public.asset_tags;
CREATE TRIGGER asset_tags_rules_aiud AFTER INSERT OR DELETE ON public.asset_tags
FOR EACH ROW EXECUTE FUNCTION public.trg_asset_tags_apply_rules();
