## Fix XP icons + top-right XP value

### Problem
- Three different XP icons in use: `Hexagon` (StatBar, Profile, Collections), `Star` (Home pending, My Assets stat + badges + pending).
- Top-right StatBar shows `user_stats.xp` (legacy table), while Home/Profile now read live XP from `subject_progression` via `usePlayerProgression`. Values disagree.

### Changes (frontend only)
1. **Unify icon = `Hexagon` with `text-xp`** everywhere XP is shown:
   - `src/routes/_authenticated/my-assets.tsx` — swap `Star` → `Hexagon` for the "XP / hr" stat tile, the pending XP inline, and the per-asset `xp_per_hour` badge; update className to `text-xp`.
   - `src/routes/_authenticated/home.tsx` — swap `Star` → `Hexagon` on the pending XP chip; `text-xp`.
   - Leave `Hexagon` usages in Profile / Collections / StatBar as-is.
2. **Fix StatBar XP value** — `src/components/StatBar.tsx`:
   - Import and call `usePlayerProgression()` for the current XP total.
   - Render `progression.currentXp` (fallback `0`) instead of `stats.xp`.
   - Keep credits/energy from `meStatsQuery` unchanged.

### Out of scope
- No schema changes, no removal of legacy `user_stats.xp` column, no changes to Profile/Home XP logic (already correct).