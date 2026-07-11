# Rewards Module — Asset Import & Sync

Enhance the existing Rewards Library to import from and reference the Assets module as the single source of truth. No changes to Assets, no new module.

## Schema (single migration)

Extend `public.rewards` with a linking layer (nullable — manual rewards keep working):

- `asset_id uuid REFERENCES assets(id) ON DELETE SET NULL`
- `asset_version int NOT NULL DEFAULT 1` — bumped on sync
- `asset_synced_at timestamptz`
- `asset_sync_status text` — `linked` | `awaiting_sync` | `unlinked` | `orphaned`
- `imported_at timestamptz`
- `source_kind text` — `manual` | `asset` | `collection` | `item_set` | `template`
- Unique partial index `(asset_id) WHERE asset_id IS NOT NULL` so an asset maps to at most one linked reward (enables skip/update/replace).
- Index on `(asset_sync_status)` and `(source_kind)`.

Trigger: when the source asset's `name / description / image_url / rarity / status / *_per_hour` change, mark linked rewards `awaiting_sync` (AFTER UPDATE on `assets`, updates `rewards.asset_sync_status`). Keeps thousands of rewards efficient — no cron needed.

RPC `sync_reward_from_asset(reward_id uuid)` — copies name/description/icon(image_url)/rarity from asset, bumps `asset_version`, sets `asset_synced_at = now()`, `asset_sync_status = 'linked'`. `SECURITY DEFINER`, admin-only via `has_role`.

RPC `import_assets_as_rewards(asset_ids uuid[], reward_type_id uuid, mode text)` where mode is `skip | update | replace`. Returns `{created, updated, skipped, replaced}`.

## Queries (`src/modules/rewards/queries.ts`)

- Extend `Reward` type with the new fields.
- `assetsForImportQuery` — pulls `assets` joined to `asset_types`, `collections`, `asset_tags` for the wizard's filters (Type / Collection / Rarity / Tier(via tag) / Profession(via tag) / Status / Tags).
- `linkedRewardsStatsQuery` — dashboard aggregates: total linked, imported count, awaiting sync, last import (`max(imported_at)`), last sync (`max(asset_synced_at)`).

## UI — `src/modules/rewards/sections/RewardsLibrary.tsx`

- Add prominent **Import Assets** button next to **New Reward**.
- Table gains an "Asset" column with a small link icon + sync-status pill (`linked` green, `awaiting_sync` amber, `unlinked` neutral, `orphaned` red).
- Row action: **Sync now** (visible when linked).
- Bulk toolbar (checkbox column): Re-sync Selected, Re-sync All Linked.
- Reward editor drawer gains **Asset Link** panel: linked asset preview, Asset ID, version, last synced, Sync Now, Open Asset (links to `/admin/modules/assets`).

## UI — new `src/modules/rewards/components/ImportAssetsWizard.tsx`

4-step modal reusing existing `panel-gold` / `inputCls` / admin table styles:

1. **Source**: card picker — Assets / Asset Collections / Item Sets / Templates. (Item Sets and Templates map to `collection_sets` and a stub "templates" empty state — surfaced but only Assets/Collections have data today; keeps the UI ready.)
2. **Filter**: multi-select chips for Asset Type, Collection, Rarity, Status, Tags + text search. Also quick-buttons: Import All / Import by Collection / Import by Profession-tag.
3. **Preview**: paginated table with checkbox, thumbnail (image_url), name, asset ID (short), category (type), rarity, tier (from tag), value (credits_per_hour), status. Select-all / deselect-all.
4. **Options**: destination Reward Type dropdown (default "Asset"), mode radios (Create / Skip Duplicates / Update Existing / Replace Existing), "Keep asset linked after import" checkbox (default on). Confirm calls `import_assets_as_rewards` RPC.

## Dashboard (`Dashboard.tsx`)

Add 5 stat cards row: Total Linked Assets · Imported Rewards · Rewards Awaiting Sync · Last Import · Last Synchronisation. Plus a small "Linked vs manual" mini bar.

## Demo Data

Seed migration links ~15 of the 20 existing assets to rewards under the "Asset" reward type (skipping duplicates by name), sets `source_kind='asset'`, `asset_sync_status='linked'`, `imported_at=now()`, `asset_synced_at=now()`. No duplicate reward rows for assets that already have a name match.

## Files

**Migration** (schema + trigger + RPCs + seed link).

**Edited**
- `src/modules/rewards/queries.ts` — types + new queries.
- `src/modules/rewards/sections/RewardsLibrary.tsx` — button, column, sync actions, bulk toolbar, editor asset panel.
- `src/modules/rewards/sections/Dashboard.tsx` — new widgets.

**New**
- `src/modules/rewards/components/ImportAssetsWizard.tsx`

## Out of scope (per spec)

- No edits to the Assets module.
- No auto-sync cron — trigger flips status to `awaiting_sync`; sync stays admin-triggered (bulk or per row). Schema is ready for a future scheduler.
