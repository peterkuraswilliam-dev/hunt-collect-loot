# Loot Tables Phase 4D — References, Analytics, Activity

Extend existing Rewards → Loot Tables (no new module). Schema already has `loot_table_references`, `loot_table_activity_log`, and `loot_tables.total_rolls` / `total_rewards_granted` / `loot_table_entries.times_awarded` — so this phase is UI + demo data + a few queries.

## 1. LootTableDetail — new tabs

Add three tabs to `src/modules/rewards/components/LootTableDetail.tsx` (after existing Loot Entries / Rules / Overview):

### References tab
- Query `loot_table_references` where `loot_table_id = current`.
- Table columns: **Module** (badge), **Record Name**, **Status** (active / draft / archived badge), **Last updated**, **Open** action.
- Module set supported: mining, woodcutting, fishing, farming, quests, achievements, events, chests, bosses, collections, mini_games (badge label + icon per module).
- "Open" uses `record_ref` — if it looks like an internal admin path (`/admin/...`) render a `<Link>`; otherwise show a disabled hint ("External reference").
- Empty state: "Not referenced anywhere yet."

### Analytics tab
Read-only stat cards from existing columns:
- **Total Rolls** — `loot_tables.total_rolls`
- **Total Rewards Granted** — `loot_tables.total_rewards_granted`
- **Most Awarded Reward** — top `loot_table_entries.times_awarded` joined to `rewards.name`
- **Least Awarded Reward** — bottom non-zero `times_awarded`
- **Last Used** — max `loot_table_activity_log.created_at` for action in ('rolled','used') falling back to table `updated_at`
- Small bar list of top 5 entries by `times_awarded`.
- Banner: "Demo statistics — reward distribution not live yet."

### Activity tab
- Query `loot_table_activity_log` ordered desc, limit 100.
- Timeline entries: icon per action (`created`, `updated`, `enabled`, `disabled`, `entry_added`, `entry_removed`), actor label (join actor_id → profiles.username fallback to `actor_label` or "System"), relative timestamp + absolute tooltip, detail JSON summary (reward name if `reward_id` present).
- Empty state: "No activity recorded."

## 2. Queries
Add to `src/modules/rewards/queries.ts`:
- `lootTableReferencesQuery(tableId)`
- `lootTableActivityQuery(tableId)`
- `lootTableAnalyticsQuery(tableId)` — combines table row + top/bottom entry with reward name.
- `lootTableUsageCountsQuery` — aggregate references per table_id (for dashboard "most used").
- `lootTablesRecentQuery` — latest 5 by `updated_at`.

## 3. Dashboard widgets
In `src/modules/rewards/sections/Dashboard.tsx` add a "Loot Tables" section:
- **Total Loot Tables**, **Active Loot Tables** (enabled=true) stat cards.
- **Most Used Loot Tables** — top 5 by reference count (click → open detail).
- **Recently Updated Loot Tables** — top 5 by `updated_at`.

## 4. Demo data (via `supabase--insert`)
- Seed `loot_table_references` for existing loot tables across all 11 modules (2–4 refs each where realistic).
- Backfill `loot_tables.total_rolls` (1k–250k) and `total_rewards_granted` (rolls × avg roll count).
- Distribute `loot_table_entries.times_awarded` proportional to weight so top/bottom queries return sensible names.
- Insert historical `loot_table_activity_log` rows (created → several updates → entry_added/removed → enabled toggles) with realistic timestamps over the past 30 days.

## Out of scope
- No live roll execution / reward distribution.
- No new module. No changes to Rules tab.

## Technical notes
- All new UI stays inside existing `LootTableDetail` modal — extend the tab list, add three panels.
- Reuse `AdminTable`, badge styles already used in Rewards module.
- References `record_ref` is free-text; treat as a hint (link only if it starts with `/`).
- Actor resolution: left join to `profiles` via server-side view isn't needed — do a second query for the set of `actor_id`s and map client-side.
