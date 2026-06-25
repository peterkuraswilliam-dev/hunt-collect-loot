
-- Rewards Module schema

-- Reward types catalog
CREATE TABLE IF NOT EXISTS public.reward_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL, -- asset|credits|energy|xp|ic|pack|spin|unlock|bundle
  icon text,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_types TO anon, authenticated;
GRANT ALL ON public.reward_types TO service_role;
ALTER TABLE public.reward_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rt_read" ON public.reward_types FOR SELECT USING (true);
CREATE POLICY "rt_admin" ON public.reward_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Pack tag pools + status
ALTER TABLE public.packs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS include_tags uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exclude_tags uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_mode text NOT NULL DEFAULT 'any';

-- Spins (multiple wheels)
CREATE TABLE IF NOT EXISTS public.spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  cooldown_seconds int NOT NULL DEFAULT 0,
  daily_limit int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spins TO anon, authenticated;
GRANT ALL ON public.spins TO service_role;
ALTER TABLE public.spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spins_read" ON public.spins FOR SELECT USING (true);
CREATE POLICY "spins_admin" ON public.spins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.spin_rewards
  ADD COLUMN IF NOT EXISTS spin_id uuid REFERENCES public.spins(id) ON DELETE CASCADE;

-- Reward bundles
CREATE TABLE IF NOT EXISTS public.reward_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  rewards jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_bundles TO anon, authenticated;
GRANT ALL ON public.reward_bundles TO service_role;
ALTER TABLE public.reward_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rb_read" ON public.reward_bundles FOR SELECT USING (true);
CREATE POLICY "rb_admin" ON public.reward_bundles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Reward sources (catalog of where rewards can come from)
CREATE TABLE IF NOT EXISTS public.reward_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  icon text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_sources TO anon, authenticated;
GRANT ALL ON public.reward_sources TO service_role;
ALTER TABLE public.reward_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs_read" ON public.reward_sources FOR SELECT USING (true);
CREATE POLICY "rs_admin" ON public.reward_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Reward log (audit)
CREATE TABLE IF NOT EXISTS public.reward_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL,
  kind text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  ref_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reward_log TO authenticated;
GRANT ALL ON public.reward_log TO service_role;
ALTER TABLE public.reward_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rl_own" ON public.reward_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rl_admin" ON public.reward_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed reward types
INSERT INTO public.reward_types (slug, name, kind, icon, sort_order, is_system) VALUES
  ('credits','Credits','credits','coins',1,true),
  ('energy','Energy','energy','zap',2,true),
  ('xp','XP','xp','star',3,true),
  ('ic','IC','ic','gem',4,true),
  ('pack','Pack','pack','package',5,true),
  ('spin_token','Spin Token','spin','sparkles',6,true),
  ('asset','Asset','asset','box',7,true),
  ('unlock','Unlock','unlock','key',8,true)
ON CONFLICT (slug) DO NOTHING;

-- Seed reward sources
INSERT INTO public.reward_sources (slug, name, icon, sort_order) VALUES
  ('mini_games','Mini Games','gamepad',1),
  ('collections','Collections','library',2),
  ('packs','Packs','package',3),
  ('spins','Spins','sparkles',4),
  ('quests','Quests','flag',5),
  ('events','Events','calendar',6),
  ('businesses','Businesses','briefcase',7),
  ('nfc','NFC','radio',8),
  ('qr','QR Codes','qr-code',9),
  ('admin','Admin Awards','shield',10)
ON CONFLICT (slug) DO NOTHING;

-- Module registration
INSERT INTO public.module_settings (module, settings) VALUES ('rewards','{}'::jsonb)
ON CONFLICT (module) DO NOTHING;

-- Tag-driven pack open: pick random matching asset
CREATE OR REPLACE FUNCTION public.pick_pack_asset(p_pack_id uuid)
RETURNS public.assets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.packs;
  a public.assets;
BEGIN
  SELECT * INTO p FROM public.packs WHERE id = p_pack_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF array_length(p.include_tags,1) IS NULL THEN
    -- fallback: any active asset
    SELECT * INTO a FROM public.assets WHERE COALESCE(status,'active')='active' ORDER BY random() LIMIT 1;
    RETURN a;
  END IF;

  IF p.match_mode = 'all' THEN
    SELECT x.* INTO a FROM public.assets x
      WHERE COALESCE(x.status,'active')='active'
        AND NOT EXISTS (
          SELECT 1 FROM unnest(p.include_tags) t
          WHERE NOT EXISTS (SELECT 1 FROM public.asset_tags at WHERE at.asset_id=x.id AND at.tag_id=t)
        )
        AND NOT EXISTS (SELECT 1 FROM public.asset_tags at2 WHERE at2.asset_id=x.id AND at2.tag_id = ANY(p.exclude_tags))
      ORDER BY random() LIMIT 1;
  ELSE
    SELECT x.* INTO a FROM public.assets x
      WHERE COALESCE(x.status,'active')='active'
        AND EXISTS (SELECT 1 FROM public.asset_tags at WHERE at.asset_id=x.id AND at.tag_id = ANY(p.include_tags))
        AND NOT EXISTS (SELECT 1 FROM public.asset_tags at2 WHERE at2.asset_id=x.id AND at2.tag_id = ANY(p.exclude_tags))
      ORDER BY random() LIMIT 1;
  END IF;
  RETURN a;
END $$;
