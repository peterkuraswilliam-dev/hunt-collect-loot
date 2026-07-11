
-- 1. Schema: linking layer on rewards
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asset_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS asset_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS asset_sync_status text NOT NULL DEFAULT 'unlinked',
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS rewards_asset_unique_idx
  ON public.rewards(asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS rewards_sync_status_idx ON public.rewards(asset_sync_status);
CREATE INDEX IF NOT EXISTS rewards_source_kind_idx ON public.rewards(source_kind);

-- 2. Trigger: asset changes flip linked rewards to awaiting_sync
CREATE OR REPLACE FUNCTION public.trg_assets_mark_rewards_awaiting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.rarity IS DISTINCT FROM OLD.rarity
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.credits_per_hour IS DISTINCT FROM OLD.credits_per_hour
     OR NEW.energy_per_hour IS DISTINCT FROM OLD.energy_per_hour
     OR NEW.xp_per_hour IS DISTINCT FROM OLD.xp_per_hour
  THEN
    UPDATE public.rewards
       SET asset_sync_status = 'awaiting_sync'
     WHERE asset_id = NEW.id AND asset_sync_status <> 'awaiting_sync';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS assets_mark_rewards_awaiting ON public.assets;
CREATE TRIGGER assets_mark_rewards_awaiting
  AFTER UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.trg_assets_mark_rewards_awaiting();

-- 3. Sync a single linked reward from its source asset
CREATE OR REPLACE FUNCTION public.sync_reward_from_asset(p_reward_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.rewards;
  a public.assets;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO r FROM public.rewards WHERE id = p_reward_id;
  IF NOT FOUND OR r.asset_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_linked');
  END IF;
  SELECT * INTO a FROM public.assets WHERE id = r.asset_id;
  IF NOT FOUND THEN
    UPDATE public.rewards SET asset_sync_status = 'orphaned' WHERE id = p_reward_id;
    RETURN jsonb_build_object('ok', false, 'error', 'orphaned');
  END IF;

  UPDATE public.rewards SET
    name = a.name,
    description = a.description,
    icon = a.image_url,
    rarity = a.rarity::text,
    asset_version = asset_version + 1,
    asset_synced_at = now(),
    asset_sync_status = 'linked'
  WHERE id = p_reward_id;

  RETURN jsonb_build_object('ok', true, 'reward_id', p_reward_id);
END $$;

-- 4. Bulk import assets as rewards
CREATE OR REPLACE FUNCTION public.import_assets_as_rewards(
  p_asset_ids uuid[],
  p_reward_type_id uuid,
  p_mode text DEFAULT 'skip',
  p_keep_linked boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a public.assets;
  existing public.rewards;
  created int := 0;
  updated int := 0;
  skipped int := 0;
  replaced int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_reward_type_id IS NULL THEN RAISE EXCEPTION 'reward_type_required'; END IF;
  IF p_mode NOT IN ('skip','update','replace') THEN p_mode := 'skip'; END IF;

  FOR a IN SELECT * FROM public.assets WHERE id = ANY(p_asset_ids) LOOP
    SELECT * INTO existing FROM public.rewards WHERE asset_id = a.id LIMIT 1;

    IF FOUND THEN
      IF p_mode = 'skip' THEN
        skipped := skipped + 1;
      ELSIF p_mode = 'update' THEN
        UPDATE public.rewards SET
          name = a.name,
          description = a.description,
          icon = a.image_url,
          rarity = a.rarity::text,
          reward_type_id = p_reward_type_id,
          asset_version = asset_version + 1,
          asset_synced_at = now(),
          asset_sync_status = 'linked'
        WHERE id = existing.id;
        updated := updated + 1;
      ELSIF p_mode = 'replace' THEN
        DELETE FROM public.rewards WHERE id = existing.id;
        INSERT INTO public.rewards (name, reward_type_id, description, icon, quantity, rarity, enabled, tags,
                                    asset_id, asset_version, asset_synced_at, asset_sync_status, imported_at, source_kind)
        VALUES (a.name, p_reward_type_id, a.description, a.image_url, 1, a.rarity::text, true, '{}',
                CASE WHEN p_keep_linked THEN a.id ELSE NULL END,
                1, now(),
                CASE WHEN p_keep_linked THEN 'linked' ELSE 'unlinked' END,
                now(), 'asset');
        replaced := replaced + 1;
      END IF;
    ELSE
      INSERT INTO public.rewards (name, reward_type_id, description, icon, quantity, rarity, enabled, tags,
                                  asset_id, asset_version, asset_synced_at, asset_sync_status, imported_at, source_kind)
      VALUES (a.name, p_reward_type_id, a.description, a.image_url, 1, a.rarity::text, true, '{}',
              CASE WHEN p_keep_linked THEN a.id ELSE NULL END,
              1, now(),
              CASE WHEN p_keep_linked THEN 'linked' ELSE 'unlinked' END,
              now(), 'asset');
      created := created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('created', created, 'updated', updated, 'skipped', skipped, 'replaced', replaced);
END $$;

-- 5. Bulk re-sync
CREATE OR REPLACE FUNCTION public.resync_linked_rewards(p_reward_ids uuid[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  FOR r IN
    SELECT id FROM public.rewards
    WHERE asset_id IS NOT NULL
      AND (p_reward_ids IS NULL OR id = ANY(p_reward_ids))
  LOOP
    PERFORM public.sync_reward_from_asset(r.id);
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'synced', n);
END $$;

-- 6. Demo seed: link ~existing assets to rewards under the 'asset' reward type
DO $seed$
DECLARE
  rt_id uuid;
  a record;
  match_id uuid;
BEGIN
  SELECT id INTO rt_id FROM public.reward_types WHERE slug = 'asset' LIMIT 1;
  IF rt_id IS NULL THEN RETURN; END IF;

  FOR a IN SELECT * FROM public.assets ORDER BY created_at LIMIT 15 LOOP
    -- Skip if already linked
    IF EXISTS (SELECT 1 FROM public.rewards WHERE asset_id = a.id) THEN CONTINUE; END IF;

    -- If a manual reward already exists with the same name, link it instead of creating a duplicate
    SELECT id INTO match_id FROM public.rewards
      WHERE asset_id IS NULL AND lower(name) = lower(a.name) LIMIT 1;
    IF match_id IS NOT NULL THEN
      UPDATE public.rewards SET
        asset_id = a.id,
        icon = COALESCE(icon, a.image_url),
        description = COALESCE(description, a.description),
        rarity = a.rarity::text,
        asset_version = 1,
        asset_synced_at = now(),
        asset_sync_status = 'linked',
        imported_at = now(),
        source_kind = 'asset'
      WHERE id = match_id;
    ELSE
      INSERT INTO public.rewards (name, reward_type_id, description, icon, quantity, rarity, enabled, tags,
                                  asset_id, asset_version, asset_synced_at, asset_sync_status, imported_at, source_kind)
      VALUES (a.name, rt_id, a.description, a.image_url, 1, a.rarity::text, true, '{}',
              a.id, 1, now(), 'linked', now(), 'asset');
    END IF;
  END LOOP;
END $seed$;
