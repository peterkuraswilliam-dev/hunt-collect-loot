# Plan: XP Curve Materialization + Modular Mining Mini Game

Two independent workstreams landing in the same phase.

---

## 1. `xp_curve_levels` Materialization (Runtime O(1) XP → Level Lookups)

### Schema (migration)
Create `public.xp_curve_levels`:
- `curve_id` (fk → xp_curves, on delete cascade)
- `level` (int)
- `xp_required` (bigint) — XP to reach this level from previous
- `xp_total` (bigint) — cumulative XP from level 1
- PK `(curve_id, level)`
- Index on `(curve_id, xp_total)` for reverse (xp → level) lookups
- GRANT SELECT to `authenticated`, `anon`; ALL to `service_role`
- RLS enabled; policy: readable to all authenticated + anon (curve data is public reference)

### Function
`public.rebuild_xp_curve_levels(p_curve_id uuid)`:
- Deletes existing rows for the curve
- Re-computes levels 1..max_level using the same math as the frontend (linear / exponential / soft_exponential / logarithmic) with `starting_xp`, `base_xp`, `growth_multiplier`, `growth_factor`, `decimal_precision`, `smoothing`
- Bulk inserts rows with running cumulative total

`public.xp_to_level(p_curve_id uuid, p_total_xp bigint)` — returns the highest level whose `xp_total <= p_total_xp` (single index scan).

### Trigger
`AFTER INSERT OR UPDATE` on `xp_curves` → calls `rebuild_xp_curve_levels(NEW.id)` when relevant math columns change. On delete cascades automatically.

### Backfill
Migration ends with `SELECT rebuild_xp_curve_levels(id) FROM xp_curves;` so existing curves are populated immediately.

### UI touchpoints
- XP Curves editor: after save, show a small "levels cached" indicator (row count from `xp_curve_levels`).
- No behavioural change to player progression yet (per Phase 5 rule — foundation only).

---

## 2. Modular Mining Mini Game

### Module registration
Add `src/modules/mining/` following the existing `AssetOSModule` contract:

```
src/modules/mining/
  index.tsx               // module def: id, name, description, version, icon, route, category, status, sections
  queries.ts              // module settings, content toggles
  sections/
    Dashboard.tsx         // status + stats
    Settings.tsx          // general / gameplay / economy / progression flags
    Content.tsx           // enable/disable areas, rocks, pickaxes, loot, events
    Permissions.tsx
    Analytics.tsx
  runtime/                // lazy-only, NEVER imported at module scope
    MiningGame.tsx        // dynamic import of pixi runtime
    pixi/                 // sprites, sounds, logic
```

Registered in `src/modules/registry.ts` under Mini Games category. Version `1.0.0-beta`. Status stored in `module_settings.settings.status` (`enabled | disabled | maintenance | beta`).

### Admin settings page (CMS-driven, no code changes for content toggles)

Stored in `module_settings` under module `mining`:

```jsonc
{
  "status": "beta",
  "navigation": { "show_in_nav": true },
  "gameplay": {
    "auto_mining": false, "critical_hits": true, "random_events": true,
    "pickaxe_upgrades": true, "xp_rewards": true, "coin_rewards": true,
    "energy_system": false
  },
  "economy": { "xp_multiplier": 1, "coin_multiplier": 1, "loot_multiplier": 1, "drop_rate_multiplier": 1 },
  "progression": { "min_level": 1, "unlock_requirement": null, "daily_play_limit": null },
  "content": {
    "areas":    { "<slug>": true, ... },
    "rocks":    { "<slug>": true, ... },
    "pickaxes": { "<slug>": true, ... },
    "loot":     { "<slug>": true, ... },
    "events":   { "<slug>": true, ... }
  }
}
```

Content section renders toggle rows sourced from mock/demo data seeded at module load (Iron Cavern, Copper Ridge, etc.). Wired to persist via existing `moduleSettingsQuery` / upsert pattern already used by other modules' `SettingsSection.tsx`.

### Runtime route
`src/routes/_authenticated/mining.tsx`:
- Reads `module_settings` for `mining`
- If `status === 'disabled'` → 404 / redirect
- If `status === 'maintenance'` → maintenance screen, no pixi load
- Else `React.lazy(() => import('@/modules/mining/runtime/MiningGame'))` inside `<Suspense>` — pixi + sprites + sounds only fetched here
- Beta badge overlay when `status === 'beta'`

### Navigation gating
`BottomNav` / any nav lister reads mining module settings; hides link when disabled OR `navigation.show_in_nav === false`.

### Integration hooks (stubs)
`src/modules/mining/runtime/hooks.ts` exposes typed no-op wrappers for: `awardXP`, `grantReward`, `addToInventory`, `unlockAsset`, `trackAnalytics`, `emitNotification`, `checkAchievement`, `craft`, `listOnMarketplace`, `fireEvent`. Each currently mocks; each has a single call site so live wiring later is a one-file change.

### Performance guarantees
- `runtime/` folder never imported from `index.tsx`, `sections/*`, or `registry.ts`.
- Route uses `React.lazy` + dynamic `import()` — no pixi in main bundle.
- Sprites/sounds referenced via URL imports inside `runtime/pixi/**` only.

### Dependency
`bun add pixi.js` (only if not already present; will check first).

---

## Deliverables
- 1 SQL migration for `xp_curve_levels` + function + trigger + backfill.
- New `src/modules/mining/` tree with CMS-driven settings + lazy runtime.
- `registry.ts` updated.
- `mining` route added under `_authenticated`.
- Nav gating hook.
- No player progression logic changes; no removal of existing modules.
