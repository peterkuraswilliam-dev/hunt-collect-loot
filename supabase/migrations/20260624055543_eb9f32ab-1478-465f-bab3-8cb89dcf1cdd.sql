
-- Collection sets (hierarchy)
CREATE TABLE public.collection_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  parent_id uuid REFERENCES public.collection_sets(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collection_sets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_sets TO authenticated;
GRANT ALL ON public.collection_sets TO service_role;
ALTER TABLE public.collection_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_sets read" ON public.collection_sets FOR SELECT USING (true);
CREATE POLICY "collection_sets admin write" ON public.collection_sets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Extend collections
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS set_id uuid REFERENCES public.collection_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS include_tags uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exclude_tags uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_mode text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS rewards jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Auto-populated collection ↔ asset join
CREATE TABLE public.collection_assets (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, asset_id)
);
GRANT SELECT ON public.collection_assets TO anon;
GRANT SELECT ON public.collection_assets TO authenticated;
GRANT ALL ON public.collection_assets TO service_role;
ALTER TABLE public.collection_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_assets read" ON public.collection_assets FOR SELECT USING (true);
CREATE POLICY "collection_assets admin write" ON public.collection_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_collection_assets_asset ON public.collection_assets(asset_id);

-- Recompute a single collection from its rules
CREATE OR REPLACE FUNCTION public.recompute_collection(p_collection_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.collections;
  inserted int := 0;
BEGIN
  SELECT * INTO c FROM public.collections WHERE id = p_collection_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  DELETE FROM public.collection_assets WHERE collection_id = p_collection_id;

  IF array_length(c.include_tags,1) IS NULL THEN RETURN 0; END IF;

  IF c.match_mode = 'any' THEN
    INSERT INTO public.collection_assets (collection_id, asset_id)
    SELECT p_collection_id, a.id FROM public.assets a
    WHERE EXISTS (
      SELECT 1 FROM public.asset_tags at
      WHERE at.asset_id = a.id AND at.tag_id = ANY(c.include_tags)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.asset_tags at2
      WHERE at2.asset_id = a.id AND at2.tag_id = ANY(c.exclude_tags)
    );
  ELSE
    -- all
    INSERT INTO public.collection_assets (collection_id, asset_id)
    SELECT p_collection_id, a.id FROM public.assets a
    WHERE NOT EXISTS (
      SELECT 1 FROM unnest(c.include_tags) t
      WHERE NOT EXISTS (
        SELECT 1 FROM public.asset_tags at WHERE at.asset_id = a.id AND at.tag_id = t
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.asset_tags at2
      WHERE at2.asset_id = a.id AND at2.tag_id = ANY(c.exclude_tags)
    );
  END IF;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END $$;

CREATE OR REPLACE FUNCTION public.recompute_all_collections()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.collections LOOP
    PERFORM public.recompute_collection(r.id);
  END LOOP;
END $$;

-- Recompute when a collection's rules change
CREATE OR REPLACE FUNCTION public.trg_collection_recompute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_collection(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_collections_rules ON public.collections;
CREATE TRIGGER trg_collections_rules
AFTER INSERT OR UPDATE OF include_tags, exclude_tags, match_mode ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.trg_collection_recompute();

-- Recompute when an asset's tags change (only collections referencing the affected tag)
CREATE OR REPLACE FUNCTION public.trg_asset_tags_recompute_collections()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; t uuid;
BEGIN
  t := COALESCE(NEW.tag_id, OLD.tag_id);
  FOR r IN
    SELECT id FROM public.collections
    WHERE t = ANY(include_tags) OR t = ANY(exclude_tags)
  LOOP
    PERFORM public.recompute_collection(r.id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_asset_tags_recompute ON public.asset_tags;
CREATE TRIGGER trg_asset_tags_recompute
AFTER INSERT OR DELETE ON public.asset_tags
FOR EACH ROW EXECUTE FUNCTION public.trg_asset_tags_recompute_collections();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_collection_sets_touch ON public.collection_sets;
CREATE TRIGGER trg_collection_sets_touch BEFORE UPDATE ON public.collection_sets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_collections_touch ON public.collections;
CREATE TRIGGER trg_collections_touch BEFORE UPDATE ON public.collections
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
