
ALTER TABLE public.xp_curves
  ADD COLUMN IF NOT EXISTS starting_xp numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS growth_factor numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS decimal_precision int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS smoothing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE UNIQUE INDEX IF NOT EXISTS xp_curves_active_name_uniq
  ON public.xp_curves (lower(name)) WHERE status = 'active';
