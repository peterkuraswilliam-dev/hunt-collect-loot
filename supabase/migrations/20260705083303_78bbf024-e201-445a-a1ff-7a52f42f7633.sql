
CREATE TABLE public.xp_curve_levels (
  curve_id uuid NOT NULL REFERENCES public.xp_curves(id) ON DELETE CASCADE,
  level integer NOT NULL,
  xp_required bigint NOT NULL,
  xp_total bigint NOT NULL,
  PRIMARY KEY (curve_id, level)
);

CREATE INDEX xp_curve_levels_total_idx ON public.xp_curve_levels (curve_id, xp_total);

GRANT SELECT ON public.xp_curve_levels TO authenticated, anon;
GRANT ALL ON public.xp_curve_levels TO service_role;

ALTER TABLE public.xp_curve_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xp_curve_levels read" ON public.xp_curve_levels
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "xp_curve_levels admin write" ON public.xp_curve_levels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Math must mirror the frontend computeLevelXP (XPCurves.tsx).
CREATE OR REPLACE FUNCTION public.rebuild_xp_curve_levels(p_curve_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.xp_curves;
  i integer;
  v numeric;
  running bigint := 0;
  ins integer := 0;
BEGIN
  SELECT * INTO c FROM public.xp_curves WHERE id = p_curve_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  DELETE FROM public.xp_curve_levels WHERE curve_id = p_curve_id;

  FOR i IN 1..c.max_level LOOP
    v := CASE c.growth_type
      WHEN 'linear' THEN
        c.starting_xp + c.base_xp * i * c.growth_factor
      WHEN 'exponential' THEN
        c.starting_xp + c.base_xp * power(c.growth_multiplier, i - 1) * c.growth_factor
      WHEN 'soft_exponential' THEN
        c.starting_xp + c.base_xp * i * power(c.growth_multiplier, sqrt(GREATEST(i - 1, 0)))
          * c.growth_factor
      WHEN 'logarithmic' THEN
        c.starting_xp + c.base_xp * c.growth_factor * (ln(i + 1) / ln(2)) * c.growth_multiplier
      WHEN 'polynomial' THEN
        c.starting_xp + c.base_xp * power(i, c.growth_multiplier) * c.growth_factor
      ELSE
        c.starting_xp + c.base_xp * i * c.growth_factor
    END;

    v := round(v, GREATEST(c.decimal_precision, 0));
    running := running + GREATEST(v, 0)::bigint;

    INSERT INTO public.xp_curve_levels (curve_id, level, xp_required, xp_total)
    VALUES (p_curve_id, i, GREATEST(v, 0)::bigint, running);
    ins := ins + 1;
  END LOOP;

  RETURN ins;
END $$;

CREATE OR REPLACE FUNCTION public.trg_rebuild_xp_curve_levels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND
     NEW.growth_type = OLD.growth_type AND
     NEW.base_xp = OLD.base_xp AND
     NEW.starting_xp = OLD.starting_xp AND
     NEW.growth_multiplier = OLD.growth_multiplier AND
     NEW.growth_factor = OLD.growth_factor AND
     NEW.max_level = OLD.max_level AND
     NEW.decimal_precision = OLD.decimal_precision THEN
    RETURN NEW;
  END IF;
  PERFORM public.rebuild_xp_curve_levels(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS xp_curves_rebuild_levels ON public.xp_curves;
CREATE TRIGGER xp_curves_rebuild_levels
AFTER INSERT OR UPDATE ON public.xp_curves
FOR EACH ROW EXECUTE FUNCTION public.trg_rebuild_xp_curve_levels();

-- O(1) reverse lookup: total XP -> highest reached level for a curve.
CREATE OR REPLACE FUNCTION public.xp_to_level(p_curve_id uuid, p_total_xp bigint)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT level FROM public.xp_curve_levels
      WHERE curve_id = p_curve_id AND xp_total <= p_total_xp
      ORDER BY xp_total DESC LIMIT 1),
    0
  );
$$;

-- Backfill for existing curves.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.xp_curves LOOP
    PERFORM public.rebuild_xp_curve_levels(r.id);
  END LOOP;
END $$;
