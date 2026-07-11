import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { inputCls } from "@/components/admin/AdminTable";
import { Layers, Boxes, Sparkles, FileText, Check, X, ChevronRight, ChevronLeft } from "lucide-react";
import {
  assetsForImportQuery,
  assetTypesLookupQuery,
  collectionsLookupQuery,
  rewardTypesQuery,
  type AssetForImport,
} from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Source = "assets" | "collections" | "item_sets" | "templates";
type Mode = "skip" | "update" | "replace";

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const STATUSES = ["active", "inactive", "draft"];

export function ImportAssetsWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: assets = [] } = useQuery(assetsForImportQuery);
  const { data: assetTypes = [] } = useQuery(assetTypesLookupQuery);
  const { data: collections = [] } = useQuery(collectionsLookupQuery);
  const { data: rewardTypes = [] } = useQuery(rewardTypesQuery);

  const [step, setStep] = useState(1);
  const [source, setSource] = useState<Source>("assets");

  // filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [collectionFilter, setCollectionFilter] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>(["active"]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // options
  const defaultRewardType = useMemo(
    () => rewardTypes.find((t) => t.slug === "asset")?.id ?? rewardTypes[0]?.id ?? "",
    [rewardTypes],
  );
  const [rewardTypeId, setRewardTypeId] = useState("");
  const [mode, setMode] = useState<Mode>("skip");
  const [keepLinked, setKeepLinked] = useState(true);

  const typeById = useMemo(() => new Map(assetTypes.map((t) => [t.id, t])), [assetTypes]);
  const collectionById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q) && !a.slug.toLowerCase().includes(q)) return false;
      if (typeFilter.length && !typeFilter.includes(a.asset_type_id ?? "")) return false;
      if (collectionFilter.length && !collectionFilter.includes(a.collection_id ?? "")) return false;
      if (rarityFilter.length && !rarityFilter.includes(a.rarity)) return false;
      if (statusFilter.length && !statusFilter.includes(a.status)) return false;
      return true;
    });
  }, [assets, search, typeFilter, collectionFilter, rarityFilter, statusFilter]);

  const runImport = useMutation({
    mutationFn: async () => {
      const rtId = rewardTypeId || defaultRewardType;
      const { data, error } = await sb.rpc("import_assets_as_rewards", {
        p_asset_ids: Array.from(selected),
        p_reward_type_id: rtId,
        p_mode: mode,
        p_keep_linked: keepLinked,
      });
      if (error) throw error;
      return data as { created: number; updated: number; skipped: number; replaced: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      onClose();
    },
  });

  if (!open) return null;

  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const selectAllVisible = () => setSelected(new Set(filtered.map((a) => a.id)));
  const clearAll = () => setSelected(new Set());
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const canNext =
    (step === 1 && source === "assets") ||
    (step === 2) ||
    (step === 3 && selected.size > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={onClose}>
      <div className="panel-gold w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="font-display text-base font-bold">Import Assets</h3>
            <div className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
              {["Source", "Filter", "Preview", "Options"].map((label, i) => (
                <span key={label} className={`px-2 py-0.5 rounded ${step === i + 1 ? "bg-primary/20 text-primary" : ""}`}>
                  {i + 1}. {label}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {step === 1 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { k: "assets" as Source, icon: Boxes, label: "Assets", note: `${assets.length} available` },
                { k: "collections" as Source, icon: Layers, label: "Asset Collections", note: `${collections.length} collections` },
                { k: "item_sets" as Source, icon: Sparkles, label: "Item Sets", note: "Coming from Asset OS" },
                { k: "templates" as Source, icon: FileText, label: "Templates", note: "No templates yet" },
              ].map((opt) => {
                const disabled = opt.k === "item_sets" || opt.k === "templates";
                const active = source === opt.k;
                return (
                  <button
                    key={opt.k}
                    disabled={disabled}
                    onClick={() => setSource(opt.k)}
                    className={`panel p-3 text-left flex items-start gap-2 disabled:opacity-40 ${active ? "ring-2 ring-primary" : ""}`}
                  >
                    <opt.icon className="h-4 w-4 mt-0.5 text-primary" />
                    <div>
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.note}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <>
              <input
                className={inputCls}
                placeholder="Search by name or slug…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <ChipGroup
                label="Asset Type"
                options={assetTypes.map((t) => ({ value: t.id, label: t.name }))}
                selected={typeFilter}
                onToggle={(v) => setTypeFilter((s) => toggle(s, v))}
              />
              <ChipGroup
                label="Collection"
                options={collections.map((c) => ({ value: c.id, label: c.name }))}
                selected={collectionFilter}
                onToggle={(v) => setCollectionFilter((s) => toggle(s, v))}
              />
              <ChipGroup
                label="Rarity"
                options={RARITIES.map((r) => ({ value: r, label: r }))}
                selected={rarityFilter}
                onToggle={(v) => setRarityFilter((s) => toggle(s, v))}
              />
              <ChipGroup
                label="Status"
                options={STATUSES.map((s) => ({ value: s, label: s }))}
                selected={statusFilter}
                onToggle={(v) => setStatusFilter((s) => toggle(s, v))}
              />
              <div className="text-xs text-muted-foreground">Matching {filtered.length} of {assets.length} assets.</div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{selected.size} of {filtered.length} selected</span>
                <div className="flex gap-2">
                  <button onClick={selectAllVisible} className="btn-secondary px-2 py-1 text-xs">Select all</button>
                  <button onClick={clearAll} className="btn-secondary px-2 py-1 text-xs">Clear</button>
                </div>
              </div>
              <div className="panel overflow-hidden">
                <div className="overflow-x-auto max-h-[45vh]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-widest text-primary sticky top-0">
                      <tr>
                        <th className="px-2 py-2 w-8" />
                        <th className="px-2 py-2">Asset</th>
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Collection</th>
                        <th className="px-2 py-2">Rarity</th>
                        <th className="px-2 py-2 text-right">Value/h</th>
                        <th className="px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a) => (
                        <PreviewRow
                          key={a.id}
                          asset={a}
                          checked={selected.has(a.id)}
                          onToggle={() => toggleOne(a.id)}
                          typeName={typeById.get(a.asset_type_id ?? "")?.name ?? "—"}
                          collectionName={collectionById.get(a.collection_id ?? "")?.name ?? "—"}
                        />
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No assets match your filters.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="panel p-3 text-xs space-y-1">
                <div><span className="text-muted-foreground">Selected:</span> <b>{selected.size}</b> assets</div>
                <div><span className="text-muted-foreground">Source:</span> {source}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Destination Reward Type</div>
                <select className={inputCls} value={rewardTypeId || defaultRewardType} onChange={(e) => setRewardTypeId(e.target.value)}>
                  {rewardTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Duplicate handling</div>
                <div className="grid gap-1 text-xs">
                  {(
                    [
                      ["skip", "Skip duplicates", "Keep existing reward rows untouched."],
                      ["update", "Update existing rewards", "Refresh name / icon / rarity from the asset."],
                      ["replace", "Replace existing rewards", "Delete and recreate the reward record."],
                    ] as Array<[Mode, string, string]>
                  ).map(([val, label, desc]) => (
                    <label key={val} className={`panel p-2 flex gap-2 items-start cursor-pointer ${mode === val ? "ring-1 ring-primary" : ""}`}>
                      <input type="radio" checked={mode === val} onChange={() => setMode(val)} />
                      <div>
                        <div className="font-semibold">{label}</div>
                        <div className="text-[10px] text-muted-foreground">{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={keepLinked} onChange={(e) => setKeepLinked(e.target.checked)} />
                Keep reward linked to asset after import (recommended)
              </label>
              {runImport.error && <p className="text-xs text-destructive">{(runImport.error as Error).message}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button
            className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-40"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </button>
          {step < 4 ? (
            <button
              className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-40"
              disabled={!canNext}
              onClick={() => setStep((s) => Math.min(4, s + 1))}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-40"
              disabled={runImport.isPending || selected.size === 0}
              onClick={() => runImport.mutate()}
            >
              <Check className="h-3.5 w-3.5" />
              {runImport.isPending ? "Importing…" : `Import ${selected.size}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              onClick={() => onToggle(o.value)}
              className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${active ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground"}`}
            >
              {o.label}
            </button>
          );
        })}
        {options.length === 0 && <span className="text-[10px] text-muted-foreground">No options</span>}
      </div>
    </div>
  );
}

function PreviewRow({
  asset,
  checked,
  onToggle,
  typeName,
  collectionName,
}: {
  asset: AssetForImport;
  checked: boolean;
  onToggle: () => void;
  typeName: string;
  collectionName: string;
}) {
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="px-2 py-1.5"><input type="checkbox" checked={checked} onChange={onToggle} /></td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          {asset.image_url ? (
            <img src={asset.image_url} alt="" className="h-7 w-7 rounded object-cover" />
          ) : (
            <div className="h-7 w-7 rounded bg-surface-2" />
          )}
          <div>
            <div className="font-semibold">{asset.name}</div>
            <div className="text-[10px] text-muted-foreground">{asset.slug}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-1.5">{typeName}</td>
      <td className="px-2 py-1.5">{collectionName}</td>
      <td className="px-2 py-1.5 capitalize">{asset.rarity}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{Number(asset.credits_per_hour).toFixed(1)}</td>
      <td className="px-2 py-1.5 capitalize">{asset.status}</td>
    </tr>
  );
}
