
CREATE TABLE IF NOT EXISTS public.currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  symbol text,
  icon text,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.currencies TO authenticated;
GRANT ALL ON public.currencies TO service_role;

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Currencies readable to authenticated" ON public.currencies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Currencies admin manage" ON public.currencies
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_currencies_updated BEFORE UPDATE ON public.currencies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.currencies (slug, name, symbol, is_system, sort_order) VALUES
  ('credits','Credits','¢',true,1),
  ('energy','Energy','⚡',true,2),
  ('xp','XP','✦',true,3),
  ('ic','IC','◈',true,4)
ON CONFLICT (slug) DO NOTHING;
