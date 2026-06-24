import { useQuery } from "@tanstack/react-query";
import { Library, Layers, CheckCircle2, Tags } from "lucide-react";
import { collectionsAllQuery, collectionSetsQuery, collectionAssetsQuery } from "../queries";

export function Dashboard() {
  const { data: collections = [] } = useQuery(collectionsAllQuery);
  const { data: sets = [] } = useQuery(collectionSetsQuery);
  const { data: links = [] } = useQuery(collectionAssetsQuery);

  const active = collections.filter((c) => c.status === "active").length;
  const counts = new Map<string, number>();
  for (const l of links) counts.set(l.collection_id, (counts.get(l.collection_id) ?? 0) + 1);
  const top = [...collections]
    .map((c) => ({ ...c, n: counts.get(c.id) ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  const recent = [...collections].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);

  const tiles = [
    { label: "Total", value: collections.length, Icon: Library },
    { label: "Active", value: active, Icon: CheckCircle2 },
    { label: "Sets", value: sets.length, Icon: Layers },
    { label: "Tagged Assets", value: links.length, Icon: Tags },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="panel p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t.label}</p>
              <t.Icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="mt-1 font-display text-xl font-extrabold">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="panel p-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Largest collections</p>
        <ul className="mt-2 space-y-1 text-sm">
          {top.map((c) => (
            <li key={c.id} className="flex justify-between"><span>{c.name}</span><span className="text-muted-foreground">{c.n} assets</span></li>
          ))}
          {top.length === 0 && <li className="text-xs text-muted-foreground">No collections yet.</li>}
        </ul>
      </div>

      <div className="panel p-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Recently created</p>
        <ul className="mt-2 space-y-1 text-sm">
          {recent.map((c) => (
            <li key={c.id} className="flex justify-between"><span>{c.name}</span><span className="text-muted-foreground">{c.status}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
