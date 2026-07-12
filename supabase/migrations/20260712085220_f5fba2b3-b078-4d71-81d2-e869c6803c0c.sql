
-- 1. Extend rewards
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS times_awarded bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_claimed bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_awarded_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_rewards_archived_at ON public.rewards(archived_at);
CREATE INDEX IF NOT EXISTS idx_rewards_category ON public.rewards(category);
CREATE INDEX IF NOT EXISTS idx_rewards_tier ON public.rewards(tier);

-- 2. Activity log
CREATE TABLE IF NOT EXISTS public.reward_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES public.rewards(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid,
  actor_label text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reward_activity_reward ON public.reward_activity_log(reward_id, created_at DESC);

GRANT SELECT ON public.reward_activity_log TO authenticated;
GRANT ALL ON public.reward_activity_log TO service_role;
ALTER TABLE public.reward_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_activity_admin_read"
  ON public.reward_activity_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Auto-log trigger
CREATE OR REPLACE FUNCTION public.trg_reward_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.reward_activity_log (reward_id, action, actor_id, detail)
    VALUES (NEW.id, 'created', v_actor, jsonb_build_object('name', NEW.name, 'source_kind', NEW.source_kind));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
      INSERT INTO public.reward_activity_log (reward_id, action, actor_id, detail)
      VALUES (NEW.id, CASE WHEN NEW.archived_at IS NULL THEN 'restored' ELSE 'archived' END, v_actor, '{}'::jsonb);
    END IF;
    IF NEW.enabled IS DISTINCT FROM OLD.enabled THEN
      INSERT INTO public.reward_activity_log (reward_id, action, actor_id, detail)
      VALUES (NEW.id, CASE WHEN NEW.enabled THEN 'enabled' ELSE 'disabled' END, v_actor, '{}'::jsonb);
    END IF;
    IF NEW.asset_id IS DISTINCT FROM OLD.asset_id THEN
      INSERT INTO public.reward_activity_log (reward_id, action, actor_id, detail)
      VALUES (NEW.id,
        CASE WHEN NEW.asset_id IS NULL THEN 'asset_unlinked' ELSE 'asset_linked' END,
        v_actor,
        jsonb_build_object('from', OLD.asset_id, 'to', NEW.asset_id));
    END IF;
    -- generic update (only if none of the above)
    IF NEW.archived_at IS NOT DISTINCT FROM OLD.archived_at
       AND NEW.enabled IS NOT DISTINCT FROM OLD.enabled
       AND NEW.asset_id IS NOT DISTINCT FROM OLD.asset_id
       AND (NEW.name IS DISTINCT FROM OLD.name
            OR NEW.description IS DISTINCT FROM OLD.description
            OR NEW.icon IS DISTINCT FROM OLD.icon
            OR NEW.quantity IS DISTINCT FROM OLD.quantity
            OR NEW.rarity IS DISTINCT FROM OLD.rarity
            OR NEW.tier IS DISTINCT FROM OLD.tier
            OR NEW.category IS DISTINCT FROM OLD.category
            OR NEW.tags IS DISTINCT FROM OLD.tags) THEN
      INSERT INTO public.reward_activity_log (reward_id, action, actor_id, detail)
      VALUES (NEW.id, 'updated', v_actor, '{}'::jsonb);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reward_audit ON public.rewards;
CREATE TRIGGER reward_audit
  AFTER INSERT OR UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public.trg_reward_audit();

-- 4. Bulk update RPC
CREATE OR REPLACE FUNCTION public.bulk_update_rewards(
  p_reward_ids uuid[],
  p_patch jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.rewards SET
    enabled       = COALESCE((p_patch->>'enabled')::boolean, enabled),
    category      = COALESCE(NULLIF(p_patch->>'category',''), category),
    tier          = COALESCE(NULLIF(p_patch->>'tier',''), tier),
    rarity        = COALESCE(NULLIF(p_patch->>'rarity',''), rarity),
    reward_type_id = COALESCE(NULLIF(p_patch->>'reward_type_id','')::uuid, reward_type_id),
    archived_at   = CASE
                      WHEN p_patch ? 'archived_at' AND (p_patch->>'archived_at') = 'null' THEN NULL
                      WHEN p_patch ? 'archived_at' AND (p_patch->>'archived_at') = 'now' THEN now()
                      ELSE archived_at
                    END
  WHERE id = ANY(p_reward_ids);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', n);
END $$;

-- 5. Clone RPC
CREATE OR REPLACE FUNCTION public.clone_reward(p_reward_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src public.rewards;
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO src FROM public.rewards WHERE id = p_reward_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'reward_not_found'; END IF;
  INSERT INTO public.rewards
    (name, reward_type_id, description, icon, quantity, rarity, enabled, tags,
     asset_id, asset_version, asset_synced_at, asset_sync_status,
     imported_at, source_kind, tier, category)
  VALUES
    (src.name || ' (copy)', src.reward_type_id, src.description, src.icon, src.quantity,
     src.rarity, src.enabled, src.tags,
     NULL, 1, NULL, 'unlinked',
     NULL, 'manual', src.tier, src.category)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
