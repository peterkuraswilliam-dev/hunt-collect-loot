
DO $$ BEGIN
  CREATE TYPE public.progression_rule_type AS ENUM (
    'global_multiplier','type_multiplier','source_multiplier',
    'level_requirement','daily_xp_limit','weekly_xp_limit',
    'min_level','max_level'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.progression_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  rule_type public.progression_rule_type NOT NULL,
  value numeric NOT NULL DEFAULT 1,
  priority int NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active',
  progression_type_id uuid REFERENCES public.progression_types(id) ON DELETE CASCADE,
  xp_source_id uuid REFERENCES public.xp_sources(id) ON DELETE CASCADE,
  starts_at timestamptz,
  ends_at timestamptz,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.progression_rules TO authenticated;
GRANT ALL ON public.progression_rules TO service_role;

ALTER TABLE public.progression_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read progression rules" ON public.progression_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage progression rules" ON public.progression_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_progression_rules_touch BEFORE UPDATE ON public.progression_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_prog_rules_active ON public.progression_rules(enabled, status, priority);

-- Rule-aware XP engine wrapper: compute effective XP then delegate to award_xp
CREATE OR REPLACE FUNCTION public.compute_effective_xp(
  p_type_id uuid, p_source_id uuid, p_amount bigint
) RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; mult numeric := 1; result numeric;
BEGIN
  FOR r IN
    SELECT * FROM public.progression_rules
    WHERE enabled = true AND status = 'active'
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
    ORDER BY priority ASC
  LOOP
    IF r.rule_type = 'global_multiplier' THEN
      mult := mult * r.value;
    ELSIF r.rule_type = 'type_multiplier' AND r.progression_type_id = p_type_id THEN
      mult := mult * r.value;
    ELSIF r.rule_type = 'source_multiplier' AND r.xp_source_id = p_source_id THEN
      mult := mult * r.value;
    END IF;
  END LOOP;
  result := p_amount::numeric * mult;
  RETURN floor(result)::bigint;
END $$;

-- Seed demo rules
INSERT INTO public.progression_rules (slug,name,description,rule_type,value,priority,enabled,notes,is_demo) VALUES
  ('demo-2x-weekend','2x XP Weekend','Global double XP event','global_multiplier',2.0,10,false,'Enable during weekend events',true),
  ('demo-mining-boost','Mining +25% XP','Mining progression type bonus','type_multiplier',1.25,50,true,'Applies to Mining progression',true),
  ('demo-combat-boost','Combat +10% XP','Combat bonus','type_multiplier',1.10,50,true,'Combat progression bonus',true),
  ('demo-daily-cap','Daily XP Cap','Player daily XP soft cap','daily_xp_limit',50000,20,true,'Advisory cap, enforced by sources',true),
  ('demo-guild-bonus','Guild XP Bonus','Guild membership XP boost','global_multiplier',1.05,80,true,'Applies to guild members',true)
ON CONFLICT (slug) DO NOTHING;
