## Phase 1 — Refactor the Rewards module

Refactor the existing Rewards module into a lean CMS-first structure with only four sections. No new module, no changes to other modules, no XP/progression logic in Rewards.

### Final section list (registry)

```text
Rewards
├── Dashboard
├── Reward Types
├── Rewards Library   ← NEW
└── Settings
```

Remove from the registry: `packs`, `pools`, `spins`, `bundles`, `inventory`, `sources`, `analytics`, `permissions`. Keep Permissions logic intact at the module level (permissions table + admin checks unchanged), just drop the section entry per the "only these four pages" requirement.

### Files

Delete these section files:
- `src/modules/rewards/sections/Packs.tsx`
- `src/modules/rewards/sections/PackPools.tsx`
- `src/modules/rewards/sections/Spins.tsx`
- `src/modules/rewards/sections/Bundles.tsx`
- `src/modules/rewards/sections/Inventory.tsx`
- `src/modules/rewards/sections/Sources.tsx`
- `src/modules/rewards/sections/Analytics.tsx`
- `src/modules/rewards/sections/Permissions.tsx`

Create:
- `src/modules/rewards/sections/RewardsLibrary.tsx`

Rewrite:
- `src/modules/rewards/index.ts` — register only Dashboard, Reward Types, Rewards Library, Settings.
- `src/modules/rewards/sections/Dashboard.tsx` — new stat/chart set (see below).
- `src/modules/rewards/sections/RewardTypes.tsx` — align fields with spec (name, internal_id, description, icon, colour, stackable, tradable, enabled).
- `src/modules/rewards/sections/SettingsSection.tsx` — form-based settings (not raw JSON) matching the Settings field list.
- `src/modules/rewards/queries.ts` — trim to types/rewards/logs; drop pack/spin/bundle/source query exports.

Do NOT touch: packs/spins/bundles DB tables, other modules, RPCs like `open_pack` / `spin_wheel`, player-facing routes, navigation, layouts, design tokens.

### Database (migration)

New tables + updates. All in `public` with GRANTs, RLS, and admin-only write policies matching existing pattern.

1. `reward_types` — add columns `internal_id text unique`, `color text`, `stackable boolean default true`, `tradable boolean default false`, `enabled boolean default true`. Keep existing `slug`, `name`, `kind`, `icon`, `description`, `sort_order`, `is_system` for back-compat; UI uses the new fields.
2. `rewards` (new) — library of reusable reward definitions:
   - `id`, `name`, `reward_type_id → reward_types`, `description`, `icon`, `quantity int default 1`, `rarity text`, `enabled boolean default true`, `tags text[] default '{}'`, `created_at`, `updated_at`.
   - Indexes on `reward_type_id`, `enabled`, GIN on `tags`.
3. `reward_module_settings` (new, single-row keyed by `id=1`) — `module_enabled`, `allow_duplicate_rewards`, `enable_reward_logging`, `default_claim_behavior text`, `default_reward_expiry_hours int`, `default_currency_precision int`.
   - Alternative: store as JSON in existing `module_settings` row (`module='rewards'`) and expose via a typed form. Chosen: **use existing `module_settings` row** to avoid a new table; form reads/writes the JSON blob but presents typed inputs.
4. Reuse existing `reward_log` for "Recent Activity" and "Most Used" dashboard stats.

Seed data (migration):
- 14 reward types listed in the brief (XP, Gold, Gems, Energy, Item, Equipment, Resource, Collection Piece, Cosmetic, Title, Badge, Chest, Key, Token) with realistic icons/colours/flags.
- ~50 rewards spanning the types with varied rarity (common/uncommon/rare/epic/legendary), quantities, tags (e.g. `daily`, `quest`, `event`, `starter`, `endgame`).

### Dashboard

Cards:
- Total Reward Types, Total Rewards, Active Rewards, Disabled Rewards.

Panels:
- Recently Created Rewards (last 10 from `rewards.created_at`).
- Most Used Rewards (top 10 grouped from `reward_log` if present, else empty state).
- Reward Distribution chart (bar per reward type — count of rewards). Use inline SVG bars to avoid new deps.
- Recent Activity (last 10 `reward_log` rows).

### Reward Types section

CRUD grid + drawer form. Fields per spec. Toggles for Stackable / Tradable / Enabled. Colour picker (text input `#hex`). Icon = lucide name text. Delete disabled for `is_system`.

### Rewards Library section

- Table with columns: Name, Type (badge w/ color), Rarity, Quantity, Tags, Enabled, Actions.
- Toolbar: search (name/description), filter by type, filter by rarity, filter by enabled, sort (name / created_at / quantity), pagination (25 per page).
- Create/Edit drawer with all spec fields. No hardcoded reward behaviour — purely data.

### Settings section

Typed form persisting to `module_settings` where `module='rewards'`:
- Module Enabled (switch)
- Allow Duplicate Rewards (switch)
- Enable Reward Logging (switch)
- Default Claim Behaviour (select: auto / manual / queued)
- Default Reward Expiry (number, hours; 0 = never)
- Default Currency Precision (number 0-8)

Save → upsert JSON blob; Dashboard/Library read flags where relevant (e.g. hide activity panel when logging disabled).

### Guarantees

- No XP or progression calculations anywhere in Rewards.
- No hardcoded reward tables/lists in code — everything reads from `reward_types` / `rewards` / `module_settings`.
- Navigation, permissions table, admin layout, design system untouched.
- Other modules unchanged.
