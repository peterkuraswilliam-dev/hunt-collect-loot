## Problem

Assets in the CMS have `xp_per_hour`, but **XP is never awarded when a player collects production**, and the "My Assets" page doesn't show any XP row.

Two things are missing:

1. **Backend** — `collect_production(p_user)` only pays credits and energy. It does not compute XP or route through the new progression engine (`submit_xp_event` / `award_xp`), so nothing lands in `subject_progression` and Home/Profile levels never move from production.
2. **Frontend** — `calcTotals` and `pendingProduction` in `src/lib/production.ts` only track credits + energy. The `/my-assets` page therefore never shows an XP/hr stat or a pending XP number, and the success toast only prints credits + energy.

## Fix

### 1. Migration — award XP inside `collect_production`

Update the RPC so that alongside credits/energy it:

- Sums `assets.xp_per_hour * quantity` across the user's inventory.
- Multiplies by `hours * production_multiplier` (same shape as credits/energy).
- Resolves the "Player" progression type (the one already used by Home/Profile via `usePlayerProgression`) — look it up by `entity_type = 'player'` (fallback: first row where the code/slug matches "player").
- Resolves an XP source for production. Use an existing `xp_sources` row with `code = 'asset_production'`; if none exists, seed one (category "Production" / "Passive") in the same migration so admins can tune it.
- Calls `public.submit_xp_event(p_user, <player_type_id>, <source_id>, <xp_amount>, 'asset_production', jsonb_build_object('hours', hours))` when `xp_amount > 0`. This automatically applies `progression_rules`, catch-up, and writes to `xp_events` + `xp_award_log` + `subject_progression`.
- Returns the awarded XP in the JSON payload: `{ credits, energy, xp, hours }`.
- Logs `xp` in the `activity_log` payload too.

No schema changes needed — just function replacement plus (optionally) seeding the `asset_production` XP source if missing.

### 2. Frontend — surface XP in `/my-assets`

- `src/lib/production.ts`: extend `ProductionTotals` with `xpPerHour` and `pendingProduction` return with `xp`. Compute `xp = Σ(asset.xp_per_hour * qty) * production_multiplier * hours`.
- `src/lib/types.ts`: add `xp?: number` to `CollectProductionResult`.
- `src/routes/_authenticated/my-assets.tsx`:
  - Add a third stat tile "XP / hr".
  - Add pending XP to the pending row.
  - Show `+X XP` in the success line.
  - Add a per-asset XP badge under each row (next to credits/energy).
  - Enable the Collect button when `pending.credits + pending.energy + pending.xp > 0`.
  - On success, also invalidate the progression queries (`subject_progression`, `xp_award_log`) so Home/Profile levels update in real time via the existing `usePlayerProgression` hook.
- `src/routes/_authenticated/home.tsx`: same success-invalidation for progression queries so the level bar reflects the collected XP immediately.

### Out of scope

- No changes to the CMS editors — they already control `xp_per_hour` and multipliers.
- No changes to the progression engine, rules, or curves.
- Spin wheel and other XP paths already have their own hooks — untouched.

## Result

Collecting production will award XP through the same pipeline as every other XP source, the "My Assets" screen will show XP/hr and pending XP, and the player's level on Home/Profile will move whenever they collect.
