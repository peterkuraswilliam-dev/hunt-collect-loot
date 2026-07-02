UPDATE public.user_stats
SET xp = GREATEST(xp, floor(random() * 4500 + 500)::int)
WHERE xp = 0;

UPDATE public.user_stats
SET level = GREATEST(1, LEAST(50, 1 + (xp / 500)::int));