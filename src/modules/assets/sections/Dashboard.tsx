import { useQuery } from "@tanstack/react-query";
import { Boxes, Sparkles, Tags, Users, TrendingUp } from "lucide-react";
import { assetsQuery } from "@/lib/queries";
import { assetTagsQuery, assetTypesQuery, ownershipStatsQuery, tagsQuery } from "../queries";

function Stat({ label, value, Icon }: { label: string; value: string | number; Icon: typeof Boxes }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <p className="mt-1 font-display text-xl font-extrabold">{value}</p>
    </div>
  );
}

export function Dashboard() {
  const { data: assets = [] } = useQuery(assetsQuery);
  const { data: types = [] } = useQuery(assetTypesQuery);
  const { data: tags = [] } = useQuery(tagsQuery);
  const { data: assetTags = [] } = useQuery(assetTagsQuery);
  const { data: ownership = [] } = useQuery(ownershipStatsQuery);

  const byRarity = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.rarity] = (acc[a.rarity] ?? 0) + 1;
    return acc;
  }, {});
  const byType = types.map((t) => ({
    name: t.name,
    count: assets.filter((a) => (a as { asset_type_id?: string }).asset_type_id === t.id).length,
  }));
  const tagCounts = tags.map((t) => ({
    name: t.name,
    color: t.color,
    count: assetTags.filter((at) => at.tag_id === t.id).length,
  }));
  const recent = [...assets].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const ownMap = new Map(ownership.map((o) => [o.asset_id, o.total]));
  const mostOwned = [...assets]
    .map((a) => ({ ...a, owned: ownMap.get(a.id) ?? 0 }))
    .sort((a, b) => b.owned - a.owned)
    .slice(0, 5);

  const totalEnergy = assets.reduce((s, a) => s + (a.energy_per_hour ?? 0), 0);
  const totalCredits = assets.reduce((s, a) => s + (a.credits_per_hour ?? 0), 0);
  const totalXp = assets.reduce((s, a) => s + (a.xp_per_hour ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Total Assets" value={assets.length} Icon={Boxes} />
        <Stat label="Types" value={types.length} Icon={Sparkles} />
        <Stat label="Tags" value={tags.length} Icon={Tags} />
        <Stat label="Unique Owners" value={ownership.length} Icon={Users} />
      </div>

      <div className="panel p-3">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">By Rarity</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(byRarity).map(([k, v]) => (
            <span key={k} className="rounded-md border border-border bg-surface-2 px-2 py-1">
              {k}: <b>{v}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="panel p-3">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">By Type</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {byType.map((t) => (
            <span key={t.name} className="rounded-md border border-border bg-surface-2 px-2 py-1">
              {t.name}: <b>{t.count}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="panel p-3">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">By Tag</p>
        {tagCounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 text-xs">
            {tagCounts.map((t) => (
              <span
                key={t.name}
                className="rounded-md border border-border bg-surface-2 px-2 py-1"
                style={{ borderColor: t.color ?? undefined }}
              >
                {t.name}: <b>{t.count}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="panel p-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Recently Created</p>
          <ul className="space-y-1 text-xs">
            {recent.map((a) => (
              <li key={a.id} className="flex justify-between"><span>{a.name}</span><span className="text-muted-foreground">{a.rarity}</span></li>
            ))}
          </ul>
        </div>
        <div className="panel p-3">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Most Owned</p>
          <ul className="space-y-1 text-xs">
            {mostOwned.map((a) => (
              <li key={a.id} className="flex justify-between"><span>{a.name}</span><span className="font-bold">{a.owned}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel-gold p-3">
        <p className="mb-2 flex items-center gap-1 text-[10px] uppercase tracking-widest"><TrendingUp className="h-3 w-3" />Production /hr (per copy)</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-surface-2 p-2"><p className="text-muted-foreground">Credits</p><p className="font-display text-lg font-bold">{totalCredits.toFixed(1)}</p></div>
          <div className="rounded-md bg-surface-2 p-2"><p className="text-muted-foreground">Energy</p><p className="font-display text-lg font-bold">{totalEnergy.toFixed(1)}</p></div>
          <div className="rounded-md bg-surface-2 p-2"><p className="text-muted-foreground">XP</p><p className="font-display text-lg font-bold">{totalXp.toFixed(1)}</p></div>
        </div>
      </div>
    </div>
  );
}
