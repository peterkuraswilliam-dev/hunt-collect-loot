## Assets Module — Asset OS Foundation

Build the first self-contained Asset OS module under `/admin/modules/assets`, following a reusable Module Contract (Dashboard, Management, Types, Rarities, Tags, Utility, Analytics, Automation, Settings, Permissions). The existing `/admin/assets` editor is upgraded into this module; nothing in the player app changes.

### 1. Database (one migration)

New tables (all with GRANTs + RLS, admin-write via `has_role`, authenticated read):
- `asset_types` — `slug`, `name`, `icon`, `sort_order`, `is_system`. Seed: landmark, character, vehicle, building, animal, product, business, event.
- `asset_rarities` — `slug` (PK text), `name`, `color`, `weight`, `sort_order`, `is_system`. Seed from existing `rarity` enum (common/rare/epic/legendary). Keep the enum for back-compat; rarities table drives the CMS UI.
- `tags` — `slug`, `name`, `color`, `icon`, `parent_id` (self-FK), `description`. Unlimited per asset.
- `asset_tags` — join (`asset_id`, `tag_id`).
- `automation_rules` — `name`, `enabled`, `trigger` (jsonb: `{event:'asset_tagged', match_tags:[...], match_mode:'all|any'}`), `action` (jsonb: `{type:'add_to_collection', collection_id}` etc.), `module` text default `assets`.
- `module_settings` — `module` (PK text), `settings` jsonb. Generic per-module key-value.
- `module_permissions` — `module`, `role` (app_role), `capability` (`view|manage|configure`), unique.

`assets` table additions: `asset_type_id` (FK, nullable), `status` (text default 'active': active/draft/archived), `description` already exists, keep `rarity` enum column.

Seed `app_role` enum with `business_owner` (in addition to existing admin/user).

Helper RPC `apply_automation_rules(p_asset_id)` — runs on asset tag changes; iterates enabled rules and applies actions (e.g. inserts into a `collection_assets` mapping or sets `collection_id`). Triggered from `asset_tags` insert/delete trigger.

### 2. Module Contract (shared scaffold)

`src/modules/contract.ts` — TypeScript interface:
```ts
interface AssetOSModule {
  slug: string; name: string; icon: LucideIcon;
  sections: { dashboard, management, tags, analytics, automation, settings, permissions }
}
```
`src/modules/registry.ts` — array of registered modules (Assets is first; future modules plug in here).

### 3. Assets Module UI

New route tree under `src/routes/_authenticated/admin/modules/assets/`:
- `route.tsx` — module shell with sub-tabs (Dashboard, Management, Types, Rarities, Tags, Utility, Analytics, Automation, Settings, Permissions).
- `index.tsx` — **Dashboard**: stat cards (Total Assets, By Rarity, By Type, By Tag), Recently Created list, Most Owned (join `user_inventory`), Production totals (sum of per-hour fields). Quick Action buttons (Create Asset / Import / Create Type / Create Tag) opening dialogs.
- `management.tsx` — Asset CRUD table with bulk select. Row fields: Name, Image, Type, Rarity, Tags (chips), Status, energy/credits/xp per hour. Bulk edit dialog for status/type/rarity/tag add-remove. Import = paste-JSON dialog.
- `types.tsx` — CRUD for `asset_types`.
- `rarities.tsx` — CRUD for `asset_rarities` (color swatch, weight).
- `tags.tsx` — CRUD with parent picker, color, icon, hierarchy preview.
- `utility.tsx` — Bulk editor for production rates (energy/credits/xp per hour) per asset or per rarity-tier preset; placeholder for future multipliers.
- `analytics.tsx` — Charts/tables: ownership totals, most collected, production per hour ranking, growth (assets created over time using `created_at` buckets).
- `automation.tsx` — Rule builder: trigger (tags match all/any) → action (add to collection). List, enable toggle, test-run button.
- `settings.tsx` — Module settings form (writes `module_settings.assets`).
- `permissions.tsx` — Matrix: role × capability checkboxes writing `module_permissions`.

Shared components in `src/modules/assets/components/`: `AssetForm`, `TagPicker`, `BulkEditBar`, `StatCard`, `RuleBuilder`.

Data layer: `src/modules/assets/queries.ts` (typed query hooks) and `src/modules/assets/mutations.ts`.

### 4. Admin nav

Add a top-level "Modules" entry in `admin/route.tsx` linking to `/admin/modules/assets`. Keep existing `/admin/assets` as a redirect to the new module's Management tab so player app and previous links still work.

### 5. Out of scope (this slice)

- Player-facing UI changes
- Other modules (Collections, Packs, etc. stay where they are; they can be migrated into the contract later)
- NFC, Marketplace, Realms — only Asset model is extended with tags so future modules can attach.

### Acceptance

- All 10 sub-tabs render and persist data
- Tagging an asset triggering a rule auto-adds it to the configured collection
- Bulk edit updates multiple assets in one call
- Permissions row controls visibility of module tabs for the `business_owner` role
- No hardcoded type/rarity/tag lists in code — all read from tables
