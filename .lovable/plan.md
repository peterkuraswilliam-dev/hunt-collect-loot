## Problem

Home shows `stats.level` from the legacy `user_stats.level` column, while Profile shows `subject_progression.current_level` from the new XP engine. The XP engine only writes to `subject_progression`, so `user_stats.level` is stale — hence the mismatch.

## Fix

Make `subject_progression` the single source of truth for player level/XP on the frontend, and keep both pages live.

### 1. Shared hook `src/lib/usePlayerProgression.ts`
- Fetch the "player" `progression_type` (cached).
- Fetch `subject_progression` row for `(uid, player_type_id)`; fall back to `{ current_level: starting_level, current_xp: starting_xp, lifetime_xp: 0 }` when no row exists.
- Fetch `progression_next_level_xp` for the current level.
- Return `{ level, currentXp, nextXp, lifetimeXp, pct, typeName }`.
- Subscribe to realtime `subject_progression` changes filtered by `subject_id=eq.{uid}` and invalidate the query. Also subscribe to `xp_award_log` inserts for the user as a backup trigger.

### 2. Home (`src/routes/_authenticated/home.tsx`)
- Replace `stats?.level ?? 1` in the Level stat tile with `level` from the hook.

### 3. Profile (`src/routes/_authenticated/profile.tsx`)
- Replace the inline `subject_progression` + `progression_next_level_xp` queries with the shared hook. Behavior unchanged.

### 4. Realtime enablement (migration)
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.subject_progression;`
- `ALTER TABLE public.subject_progression REPLICA IDENTITY FULL;`

No changes to backend XP logic, RLS, or the `user_stats` schema. `user_stats.level` becomes unused for display but is left in place to avoid churn.
