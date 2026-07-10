
ALTER TABLE public.rested_xp_configs ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.catchup_xp_configs ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
