
CREATE TABLE public.reward_saved_filters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'rewards.library',
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_saved_filters TO authenticated;
GRANT ALL ON public.reward_saved_filters TO service_role;

ALTER TABLE public.reward_saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved filters"
  ON public.reward_saved_filters FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_reward_saved_filters_updated_at
  BEFORE UPDATE ON public.reward_saved_filters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reward_saved_filters_user_scope
  ON public.reward_saved_filters (user_id, scope);
