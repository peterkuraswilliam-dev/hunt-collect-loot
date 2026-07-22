import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Play, Filter, Zap, Package, Dice5, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable } from "@/components/admin/AdminTable";
import { distributionRequestsQuery, rewardsQuery, rewardBundlesQuery, type DistributionRequest } from "../queries";
import { DistributionDetail, StatusBadge } from "../components/DistributionDetail";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const STATUSES = ["pending", "processing", "completed", "failed", "cancelled"] as const;
const TYPES = ["direct", "bundle", "loot_table"] as const;
const MODULES = ["mining", "quests", "achievements", "events", "collections", "daily_login", "admin"];

const TYPE_ICON: Record<string, typeof Package> = { direct: Zap, bundle: Package, loot_table: Dice5 };

export function Distribution() {
  const qc = useQueryClient();
  const { data: requests = [], isLoading } = useQuery(distributionRequestsQuery);
  const { data: rewards = [] } = useQuery(rewardsQuery);
  const { data: bundles = [] } = useQuery(rewardBundlesQuery);
  const [tables, setTables] = useState<Map<string, string>>(new Map());
  useQuery({
    queryKey: ["loot_tables_names"],
    queryFn: async () => {
      const { data } = await sb.from("loot_tables").select("id,name");
      const m = new Map<string, string>();
      for (const r of (data ?? []) as Array<{ id: string; name: string }>) m.set(r.id, r.name);
      setTables(m);
      return data;
    },
  });

  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<string>("");
  const [fType, setFType] = useState<string>("");
  const [fModule, setFModule] = useState<string>("");
  const [open, setOpen] = useState<DistributionRequest | null>(null);

  const rewardById = useMemo(() => new Map(rewards.map((r) => [r.id, r.name])), [rewards]);
  const bundleById = useMemo(() => new Map(bundles.map((b) => [b.id, b.name])), [bundles]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (fStatus && r.status !== fStatus) return false;
      if (fType && r.request_type !== fType) return false;
      if (fModule && r.source_module !== fModule) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !r.id.toLowerCase().includes(s) &&
          !(r.source_record_name ?? "").toLowerCase().includes(s) &&
          !r.source_module.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [requests, fStatus, fType, fModule, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
    for (const r of requests) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [requests]);

  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of requests) m.set(r.source_module, (m.get(r.source_module) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [requests]);

  const processPending = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await sb.rpc("process_reward_distribution_request", { p_request_id: id });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Processed");
      qc.invalidateQueries({ queryKey: ["distribution_requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sourceLabel = (r: DistributionRequest) => {
    if (r.request_type === "direct") return rewardById.get(r.reward_id ?? "") ?? "—";
    if (r.request_type === "bundle") return bundleById.get(r.reward_bundle_id ?? "") ?? "—";
    if (r.request_type === "loot_table") return tables.get(r.loot_table_id ?? "") ?? "—";
    return "—";
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Pending" value={counts.pending} tone="amber" />
        <Stat label="Processing" value={counts.processing} tone="blue" />
        <Stat label="Completed" value={counts.completed} tone="emerald" />
        <Stat label="Failed" value={counts.failed} tone="red" />
        <Stat label="Cancelled" value={counts.cancelled} tone="muted" />
      </div>

      <div className="panel p-3">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-primary">Requests by source</div>
        {bySource.length === 0 ? (
          <p className="text-xs text-muted-foreground">No requests yet.</p>
        ) : (
          <ul className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {bySource.map(([mod, n]) => (
              <li key={mod} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                <span className="font-semibold">{mod}</span>
                <span className="tabular-nums text-muted-foreground">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel flex flex-wrap items-center gap-2 p-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded border border-border bg-surface-2 pl-7 pr-2 py-1.5 text-xs outline-none focus:border-primary"
            placeholder="Search id, record, module..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="rounded border border-border bg-surface-2 px-2 py-1.5 text-xs" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="rounded border border-border bg-surface-2 px-2 py-1.5 text-xs" value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="rounded border border-border bg-surface-2 px-2 py-1.5 text-xs" value={fModule} onChange={(e) => setFModule(e.target.value)}>
          <option value="">All modules</option>
          {MODULES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["distribution_requests"] })}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:bg-surface-2"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="panel p-6 text-center text-xs text-muted-foreground">Loading…</div>
      ) : (
        <AdminTable
          rows={filtered}
          empty="No distribution requests match these filters."
          columns={[
            {
              key: "id",
              label: "Request",
              render: (r) => (
                <button className="text-left font-mono text-[10px] hover:text-primary" onClick={() => setOpen(r)}>
                  {r.id.slice(0, 8)}
                </button>
              ),
            },
            { key: "source", label: "Source", render: (r) => (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.source_module}</div>
                <div className="truncate">{r.source_record_name ?? "—"}</div>
              </div>
            )},
            { key: "player", label: "Player", render: (r) => (
              <span className="font-mono text-[10px]">{r.player_id?.slice(0, 8) ?? "—"}</span>
            )},
            { key: "type", label: "Type", render: (r) => {
              const Icon = TYPE_ICON[r.request_type] ?? Package;
              return <span className="inline-flex items-center gap-1"><Icon className="h-3 w-3" />{r.request_type}</span>;
            }},
            { key: "reward", label: "Reward Source", render: (r) => <span className="truncate">{sourceLabel(r)}</span> },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "created", label: "Created", render: (r) => (
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
            )},
            { key: "processed", label: "Processed", render: (r) => (
              <span className="text-muted-foreground">{r.processed_at ? new Date(r.processed_at).toLocaleDateString() : "—"}</span>
            )},
            { key: "actions", label: "", render: (r) => (
              <div className="flex justify-end gap-1">
                {(r.status === "pending" || r.status === "failed") && (
                  <button
                    onClick={() => processPending.mutate(r.id)}
                    className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/20"
                  >
                    <Play className="h-3 w-3" /> Process
                  </button>
                )}
                <button onClick={() => setOpen(r)} className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-surface-2">
                  Open
                </button>
              </div>
            )},
          ]}
        />
      )}

      {open && <DistributionDetail request={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "amber" | "blue" | "emerald" | "red" | "muted" }) {
  const map: Record<string, string> = {
    amber: "text-amber-500",
    blue: "text-blue-500",
    emerald: "text-emerald-500",
    red: "text-red-500",
    muted: "text-muted-foreground",
  };
  return (
    <div className="panel px-3 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${map[tone]}`}>{value}</div>
    </div>
  );
}
