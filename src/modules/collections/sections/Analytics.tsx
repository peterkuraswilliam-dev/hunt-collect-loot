import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { collectionsAllQuery, collectionAssetsQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Analytics() {
  const { data: collections = [] } = useQuery(collectionsAllQuery);
  const { data: links = [] } = useQuery(collectionAssetsQuery);
  const { data: claims = [] } = useQuery({
    queryKey: ["collection_claims_all"],
    queryFn: async (): Promise<Array<{ collection_id: string; threshold: number }>> => {
      const { data, error } = await sb.from("user_collection_claims").select("collection_id, threshold");
      if (error) throw error;
      return data ?? [];
    },
  });

  const counts = new Map<string, number>();
  for (const l of links) counts.set(l.collection_id, (counts.get(l.collection_id) ?? 0) + 1);
  const claimsBy = new Map<string, number>();
  for (const c of claims) claimsBy.set(c.collection_id, (claimsBy.get(c.collection_id) ?? 0) + 1);

  const rows = collections.map((c) => ({
    name: c.name,
    assets: counts.get(c.id) ?? 0,
    claims: claimsBy.get(c.id) ?? 0,
  })).sort((a, b) => b.claims - a.claims);

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Most completed</p>
        <ul className="mt-2 space-y-1 text-sm">
          {rows.slice(0, 10).map((r) => (
            <li key={r.name} className="flex justify-between">
              <span>{r.name}</span>
              <span className="text-muted-foreground">{r.claims} claims · {r.assets} assets</span>
            </li>
          ))}
          {rows.length === 0 && <li className="text-xs text-muted-foreground">No data yet.</li>}
        </ul>
      </div>

      <div className="panel p-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Totals</p>
        <p className="font-display text-xl font-extrabold mt-1">{claims.length} reward claims</p>
        <p className="text-xs text-muted-foreground">{links.length} asset memberships across {collections.length} collections</p>
      </div>
    </div>
  );
}
