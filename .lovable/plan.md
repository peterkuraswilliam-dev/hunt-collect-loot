## Phase 1 — Remove Legacy XP System (cleanup only)

Goal: strip all hardcoded XP curve / level logic and legacy XP surfaces so the codebase is ready for a future CMS-driven Experience & Progression module. **No new system built in this phase.** Player XP/level columns are preserved for later migration.

---

### 1. Database (single migration)

Strip XP awards and level recompute from DB functions, drop the legacy curve setting. **Keep `user_stats.xp` and `user_stats.level` data intact.**

- `game_settings`: drop column `xp_per_level` (the only hardcoded curve knob).
- `economy_multipliers`: drop column `xp_multiplier` (legacy XP scaler — production_multiplier stays for credits/energy).
- `collect_production(p_user)`: remove `total_xp` calculation, remove `xp` / `level` updates, remove `xp` from activity payload. Still returns `xp: 0` in JSON for backward compat with the client until callers are updated in the same phase.
- `spin_wheel(p_user)`: remove the `WHEN 'xp'` branch entirely. If a legacy `spin_rewards` row with `kind='xp'` is rolled, treat as no-op (log + return reward with `amount: 0`). Also delete existing `spin_rewards` rows where `kind='xp'` so the wheel no longer offers it.
- `spin_rewards.kind` check constraint: drop `'xp'` from the allowed set.
- `reward_types` / `reward_log` / `reward_bundles`: remove any seeded rows referencing kind `xp` so the Rewards module no longer offers XP as a reward type.
- Leave `user_stats.xp` and `user_stats.level` columns + data untouched.

### 2. Server-side types regeneration

After the migration runs, `src/integrations/supabase/types.ts` regenerates automatically — no manual edit.

### 3. Frontend code removal / decoupling

**Delete:**
- `src/modules/economy/sections/Balancing.tsx` — the "XP curve" card and `xp_per_level` save mutation. The Pack prices + Spin reward tables in this file stay; only the XP curve `<section>` is removed. (File kept, section deleted.)
- The `xp_multiplier` field from `src/modules/economy/sections/Multipliers.tsx` form.
- Any `kind: 'xp'` option in `src/modules/rewards/sections/RewardTypes.tsx`, `Spins.tsx`, `Bundles.tsx` dropdowns/selects.

**Edit types in `src/lib/types.ts`:**
- `GameSettings`: remove `xp_per_level`.
- `EconomyMultipliers`: remove `xp_multiplier`.
- `SpinReward.kind`: drop `'xp'` from the union.

**Edit `src/lib/queries.ts`:** ensure no select pulls the dropped columns.

**Decouple XP display surfaces** (keep showing stored XP/level, no curve math):
- `src/routes/_authenticated/profile.tsx`: remove `xpInLevel` / `xpPct` progress bar (depends on `xp_per_level`). Replace with a simple "Total XP" readout + a "Progression coming soon" note. Keep level number display (reads stored `user_stats.level`).
- `src/components/StatBar.tsx`: keep the XP chip (it just reads total xp — no curve).
- `src/routes/_authenticated/home.tsx`, `my-assets.tsx`, `src/lib/production.ts`: remove XP from production preview math and from any "+X XP" UI. Production preview now shows credits + energy only.
- `src/modules/economy/sections/Dashboard.tsx`: remove "XP earned today" tile (legacy aggregate). Replaced with a small "Progression: coming soon" placeholder tile.
- `src/routes/_authenticated/admin/index.tsx`: remove the "Total XP" tile.

**Imports & dead code:** delete now-unused `Hexagon` icon imports, `xp_per_level` references, and any `xp`-keyed reducers left dangling.

### 4. Admin UI placeholder

The Economy → Balancing tab currently houses the XP curve. After removal, Balancing still has Pack prices + Spin reward values, so it stays. There is no XP-exclusive admin page to replace.

Add a **new Economy section** `Progression` (placeholder only):
- `src/modules/economy/sections/Progression.tsx` — a single panel: "Experience & Progression module coming soon."
- Register it in `src/modules/economy/index.ts` so admins see where the new system will live.

### 5. Validation checklist (run before finishing)

- `rg -n "xp_per_level|xp_multiplier"` → zero hits in `src/` (excluding `types.ts` auto-gen until migration runs).
- `rg -n "kind.*['\"]xp['\"]"` → zero hits.
- `bun run build` (or whatever the project's typecheck is) clean.
- Manual smoke: load `/`, `/profile`, `/admin/modules/economy` — no console errors.

---

### Deliverables produced at end of phase

1. **Removed:** XP curve setting, XP multiplier, XP spin-reward kind, XP from production payouts, XP curve admin card, XP progress bar on profile, XP tiles on dashboards, XP from reward types.
2. **Files modified:** migration file + ~10 TS/TSX files listed above.
3. **Still depends on future module:** stored `user_stats.xp` / `user_stats.level` (data preserved, no writer remains); `Progression` placeholder tab; XP chip in `StatBar` displays a frozen total.
4. **Migration notes for next phase:** new module owns curve table, level recompute trigger/function, XP award sources (production, spins, packs, quests), and backfills `user_stats.level` from preserved XP.

### Out of scope (explicitly NOT in this phase)

New curve table, level formulas, CMS pages for progression, XP award wiring, player progression UI.
