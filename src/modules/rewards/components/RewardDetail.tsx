import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X, Link2, RefreshCw, ExternalLink, Unlink, Search, Package, Activity,
  LineChart, Info, Layers, TrendingUp, Calendar, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import {
  assetsForImportQuery, assetTypesLookupQuery, collectionsLookupQuery,
  rewardActivityQuery, rewardReferencesQuery, rewardTypesQuery,
  type Reward,
} from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const TIERS = ["I", "II", "III", "IV", "V"];

type Tab = "overview" | "asset" | "references" | "analytics" | "activity";

const TABS: Array<{ key: Tab; label: string; icon: typeof Info }> = [
  { key: "overview", label: "Overview", icon: Info },
  { key: "asset", label: "Asset Link", icon: Link2 },
  { key: "references", label: "References", icon: Package },
  { key: "analytics", label: "Analytics", icon: LineChart },
  { key: "activity", label: "Activity", icon: Activity },
];

function statusPill(s: Reward["asset_sync_status"]) {
  const map: Record<string, string> = {
    linked: "bg-emerald-500/15 text-emerald-400",
    awaiting_sync: "bg-amber-500/15 text-amber-400",
    unlinked: "bg-muted/40 text-muted-foreground",
    orphaned: "bg-red-500/15 text-red-400",
  };
  return map[s] ?? map.unlinked;
}

export function RewardDetail({
  reward,
  onClose,
}: {
  reward: Partial<Reward> & { id?: string };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState<Partial<Reward>>(reward);
  const isNew = !editing.id;

  const { data: types = [] } = useQuery(rewardTypesQuery);
  const { data: assets = [] } = useQuery(assetsForImportQuery);
  const { data: assetTypes = [] } = useQuery(assetTypesLookupQuery);
  const { data: collections = [] } = useQuery(collectionsLookupQuery);
  const { data: activity = [] } = useQuery(rewardActivityQuery(editing.id ?? null));
  const { data: refs } = useQuery(rewardReferencesQuery(editing.id ?? null));

  const linkedAsset = editing.asset_id ? assets.find((a) => a.id === editing.asset_id) : null;
  const assetTypeName = linkedAsset ? assetTypes.find((t) => t.id === linkedAsset.asset_type_id)?.name : null;
  const collectionName = linkedAsset ? collections.find((c) => c.id === linkedAsset.collection_id)?.name : null;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: editing.name!,
        reward_type_id: editing.reward_type_id!,
        description: editing.description ?? null,
        icon: editing.icon ?? null,
        quantity: editing.quantity ?? 1,
        rarity: editing.rarity ?? "common",
        enabled: editing.enabled ?? true,
        tags: editing.tags ?? [],
        tier: editing.tier ?? null,
        category: editing.category ?? null,
      };
      if (editing.id) {
        const { error } = await sb.from("rewards").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("rewards").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      qc.invalidateQueries({ queryKey: ["reward_activity"] });
      onClose();
    },
  });

  const linkAsset = useMutation({
    mutationFn: async (assetId: string | null) => {
      const patch: Record<string, unknown> = { asset_id: assetId };
      if (assetId) {
        patch.asset_sync_status = "linked";
        patch.source_kind = "asset";
        patch.asset_synced_at = new Date().toISOString();
        patch.asset_version = (editing.asset_version ?? 0) + 1;
      } else {
        patch.asset_sync_status = "unlinked";
        patch.source_kind = "manual";
      }
      const { error } = await sb.from("rewards").update(patch).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: (_d, assetId) => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      qc.invalidateQueries({ queryKey: ["reward_activity"] });
      setEditing((e) => ({
        ...e,
        asset_id: assetId ?? null,
        asset_sync_status: assetId ? "linked" : "unlinked",
        asset_synced_at: assetId ? new Date().toISOString() : e.asset_synced_at ?? null,
        source_kind: assetId ? "asset" : "manual",
      }));
    },
  });

  const syncOne = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc("sync_reward_from_asset", { p_reward_id: editing.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      qc.invalidateQueries({ queryKey: ["reward_activity"] });
    },
  });

  // Demo analytics (deterministic per reward id)
  const analytics = useMemo(() => {
    const seed = (editing.id ?? "seed").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = (n: number) => ((seed * (n + 1)) % 977) / 977;
    const times_awarded = editing.times_awarded || Math.floor(200 + rand(1) * 4800);
    const times_claimed = editing.times_claimed || Math.floor(times_awarded * (0.6 + rand(2) * 0.35));
    const active_bundles = refs?.bundles.filter((b) => b.enabled).length ?? 0;
    const avg_qty = ((editing.quantity ?? 1) + rand(3) * 3).toFixed(1);
    const sources = ["Quest Reward", "Daily Login", "Bundle Drop", "Collection Bonus", "Import"];
    const most_common = sources[Math.floor(rand(4) * sources.length)];
    const last = editing.last_awarded_at ?? new Date(Date.now() - rand(5) * 86400000 * 5).toISOString();
    const trend = Array.from({ length: 12 }, (_, i) => Math.round(30 + rand(i + 7) * 90));
    return { times_awarded, times_claimed, active_bundles, avg_qty, most_common, last, trend };
  }, [editing, refs]);

  const trendMax = Math.max(1, ...analytics.trend);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 sm:items-center" onClick={onClose}>
      <div className="panel-gold w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold truncate">{isNew ? "New Reward" : editing.name ?? "Reward"}</h3>
            {!isNew && (
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>ID {editing.id?.slice(0, 8)}</span>
                <span>·</span>
                <span className="capitalize">{editing.source_kind ?? "manual"}</span>
                {editing.asset_id && (
                  <span className={`rounded px-1 text-[10px] ${statusPill(editing.asset_sync_status as Reward["asset_sync_status"])}`}>
                    {(editing.asset_sync_status ?? "linked").replace("_", " ")}
                  </span>
                )}
                {editing.archived_at && <span className="text-red-400">Archived</span>}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>

        {!isNew && (
          <div className="flex flex-wrap gap-1 border-b border-border bg-surface-2 px-2 py-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] ${tab === t.key ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-surface"}`}
              >
                <t.icon className="h-3 w-3" /> {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {(isNew || tab === "overview") && (
            <>
              <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Reward Type">
                  <select className={inputCls} value={editing.reward_type_id ?? ""} onChange={(e) => setEditing({ ...editing, reward_type_id: e.target.value })}>
                    <option value="">—</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <input className={inputCls} value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="e.g. Loot, Currency" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Rarity">
                  <select className={inputCls} value={editing.rarity ?? "common"} onChange={(e) => setEditing({ ...editing, rarity: e.target.value })}>
                    {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Tier">
                  <select className={inputCls} value={editing.tier ?? ""} onChange={(e) => setEditing({ ...editing, tier: e.target.value })}>
                    <option value="">—</option>
                    {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Quantity"><input type="number" className={inputCls} value={editing.quantity ?? 1} onChange={(e) => setEditing({ ...editing, quantity: Number(e.target.value) })} /></Field>
              </div>
              <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
              <Field label="Icon (lucide name or URL)"><input className={inputCls} value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></Field>
              <Field label="Tags (comma separated)">
                <input className={inputCls} value={(editing.tags ?? []).join(", ")}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </Field>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={editing.enabled ?? true} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> Enabled
              </label>
            </>
          )}

          {!isNew && tab === "asset" && (
            <AssetLinkTab
              editing={editing}
              linkedAsset={linkedAsset}
              assetTypeName={assetTypeName}
              collectionName={collectionName}
              assets={assets}
              onSync={() => syncOne.mutate()}
              onUnlink={() => linkAsset.mutate(null)}
              onLink={(id) => linkAsset.mutate(id)}
              syncing={syncOne.isPending}
            />
          )}

          {!isNew && tab === "references" && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-widest text-primary">Reward Bundles</div>
              {refs?.bundles.length ? (
                <div className="panel overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-surface-2 text-[10px] uppercase text-primary">
                      <tr>
                        <th className="px-3 py-2">Bundle</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Slot</th>
                        <th className="px-3 py-2">Updated</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {refs.bundles.map((b) => (
                        <tr key={b.id} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-2 font-semibold">{b.name}</td>
                          <td className="px-3 py-2">{b.enabled ? <span className="text-primary">Active</span> : <span className="text-muted-foreground">Disabled</span>}</td>
                          <td className="px-3 py-2">{b.guaranteed ? "Guaranteed" : "Random"}{b.quantity_override ? ` × ${b.quantity_override}` : ""}</td>
                          <td className="px-3 py-2 text-muted-foreground">{new Date(b.updated_at).toLocaleDateString()}</td>
                          <td className="px-3 py-2 text-right">
                            <a href="/admin/modules/rewards" className="rounded p-1 hover:bg-surface-2 inline-block"><ExternalLink className="h-3 w-3" /></a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="panel p-6 text-center text-xs text-muted-foreground">
                  <Package className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  Not referenced by any bundle yet.
                </div>
              )}
              <div className="text-[10px] uppercase tracking-widest text-primary pt-2">Future integrations</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                {["Reward Conditions", "Reward Tables", "Quests", "Achievements", "Daily Login", "Battle Pass", "Mini-games", "Collections", "Events"].map((m) => (
                  <div key={m} className="panel p-2 text-center text-muted-foreground">{m}<div className="text-[9px] opacity-60">Coming soon</div></div>
                ))}
              </div>
            </div>
          )}

          {!isNew && tab === "analytics" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MetricCard icon={TrendingUp} label="Times Awarded" value={analytics.times_awarded.toLocaleString()} />
                <MetricCard icon={TrendingUp} label="Times Claimed" value={analytics.times_claimed.toLocaleString()} />
                <MetricCard icon={Layers} label="Active Bundles" value={analytics.active_bundles} />
                <MetricCard icon={TrendingUp} label="Avg Quantity" value={analytics.avg_qty} />
                <MetricCard icon={Calendar} label="Last Awarded" value={new Date(analytics.last).toLocaleDateString()} />
                <MetricCard icon={Info} label="Most Common Source" value={analytics.most_common} />
              </div>
              <div className="panel p-3">
                <div className="text-[10px] uppercase tracking-widest text-primary mb-2">Popularity trend (last 12 weeks)</div>
                <div className="flex items-end gap-1 h-24">
                  {analytics.trend.map((v, i) => (
                    <div key={i} className="flex-1 bg-primary/60 rounded-t" style={{ height: `${(v / trendMax) * 100}%` }} title={String(v)} />
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Demo analytics — connect a live event stream to replace these numbers.</p>
            </div>
          )}

          {!isNew && tab === "activity" && (
            <div className="space-y-2">
              {activity.length === 0 ? (
                <div className="panel p-6 text-center text-xs text-muted-foreground">No activity recorded yet.</div>
              ) : (
                <ol className="space-y-1.5">
                  {activity.map((a) => (
                    <li key={a.id} className="panel p-2 flex items-start gap-2 text-xs">
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <User className="h-3 w-3 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold capitalize">{a.action.replace("_", " ")}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {a.actor_id ? `by ${a.actor_id.slice(0, 8)}` : "system"} · {new Date(a.created_at).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border p-3">
          <button onClick={onClose} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Close</button>
          {(isNew || tab === "overview") && (
            <button
              disabled={save.isPending || !editing.name || !editing.reward_type_id}
              onClick={() => save.mutate()}
              className="btn-gold flex-1 py-2 text-xs disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Info; label: string; value: number | string }) {
  return (
    <div className="panel p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground"><Icon className="h-3 w-3" /> {label}</div>
      <div className="font-display text-base font-bold mt-0.5">{value}</div>
    </div>
  );
}

function AssetLinkTab({
  editing, linkedAsset, assetTypeName, collectionName,
  assets, onSync, onUnlink, onLink, syncing,
}: {
  editing: Partial<Reward>;
  linkedAsset: { id: string; name: string; image_url: string | null; rarity: string; slug: string } | null | undefined;
  assetTypeName: string | null | undefined;
  collectionName: string | null | undefined;
  assets: Array<{ id: string; name: string; image_url: string | null; rarity: string; slug: string }>;
  onSync: () => void;
  onUnlink: () => void;
  onLink: (id: string) => void;
  syncing: boolean;
}) {
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState("");
  const filtered = q ? assets.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30) : assets.slice(0, 30);

  return (
    <div className="space-y-3">
      {linkedAsset ? (
        <div className="panel p-3 space-y-3">
          <div className="flex gap-3">
            {linkedAsset.image_url ? (
              <img src={linkedAsset.image_url} alt="" className="h-20 w-20 rounded object-cover" />
            ) : (
              <div className="h-20 w-20 rounded bg-surface-2" />
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-sm font-semibold">{linkedAsset.name}</div>
              <div className="text-[10px] text-muted-foreground">ID {linkedAsset.id.slice(0, 8)} · v{editing.asset_version}</div>
              <div className="text-[10px] text-muted-foreground">
                Last synced {editing.asset_synced_at ? new Date(editing.asset_synced_at).toLocaleString() : "—"}
              </div>
              <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] ${statusPill(editing.asset_sync_status as Reward["asset_sync_status"])}`}>
                {(editing.asset_sync_status ?? "linked").replace("_", " ")}
              </span>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Info2 label="Asset Type" value={assetTypeName ?? "—"} />
            <Info2 label="Collection" value={collectionName ?? "—"} />
            <Info2 label="Item Set" value="—" />
            <Info2 label="Rarity" value={linkedAsset.rarity} />
            <Info2 label="Tier" value={editing.tier ?? "—"} />
            <Info2 label="Category" value={editing.category ?? "—"} />
          </dl>
          <div className="flex flex-wrap gap-2">
            <button onClick={onSync} disabled={syncing} className="btn-gold inline-flex items-center gap-1 px-2 py-1 text-xs">
              <RefreshCw className="h-3 w-3" /> Sync Now
            </button>
            <button onClick={() => setPicker(true)} className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs">
              <Link2 className="h-3 w-3" /> Change Asset
            </button>
            <button onClick={onUnlink} className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs">
              <Unlink className="h-3 w-3" /> Remove Link
            </button>
            <a href="/admin/modules/assets" target="_blank" rel="noreferrer" className="btn-secondary inline-flex items-center gap-1 px-2 py-1 text-xs">
              <ExternalLink className="h-3 w-3" /> Open Asset
            </a>
          </div>
        </div>
      ) : (
        <div className="panel p-6 text-center space-y-2">
          <Link2 className="h-6 w-6 mx-auto opacity-40" />
          <div className="text-xs text-muted-foreground">This reward is not linked to an asset.</div>
          <button onClick={() => setPicker(true)} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
            <Link2 className="h-3 w-3" /> Link Asset
          </button>
        </div>
      )}

      {picker && (
        <div className="panel p-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input className={inputCls + " pl-7"} placeholder="Search assets…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <div className="max-h-60 overflow-auto divide-y divide-border/40">
            {filtered.map((a) => (
              <button
                key={a.id}
                onClick={() => { onLink(a.id); setPicker(false); }}
                className="w-full flex items-center gap-2 py-1.5 px-1 text-left text-xs hover:bg-surface-2"
              >
                {a.image_url ? <img src={a.image_url} alt="" className="h-6 w-6 rounded object-cover" /> : <div className="h-6 w-6 rounded bg-surface-2" />}
                <span className="flex-1 font-semibold truncate">{a.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{a.rarity}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No matches.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Info2({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="text-xs font-semibold capitalize">{value}</dd>
    </div>
  );
}
