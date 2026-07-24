import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, CheckCircle2, Clock, XCircle, Ban, AlertTriangle, Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { playerInboxQuery, type ClaimStatus, type RewardInboxRow } from "@/modules/rewards/queries";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: InboxPage,
  head: () => ({
    meta: [
      { title: "Reward Inbox — Asset Realms" },
      { name: "description", content: "Claim rewards earned from quests, events, and daily activity." },
      { property: "og:title", content: "Reward Inbox — Asset Realms" },
      { property: "og:description", content: "Claim rewards earned from quests, events, and daily activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const FILTERS: Array<{ key: "unclaimed" | "claimed" | "expired" | "failed" | "all"; label: string }> = [
  { key: "unclaimed", label: "Unclaimed" },
  { key: "claimed", label: "Claimed" },
  { key: "expired", label: "Expired" },
  { key: "failed", label: "Failed" },
  { key: "all", label: "All" },
];

const STATUS_COLOR: Record<ClaimStatus, string> = {
  pending: "text-amber-500",
  available: "text-blue-400",
  claimed: "text-emerald-500",
  expired: "text-muted-foreground",
  failed: "text-red-500",
  cancelled: "text-muted-foreground",
};

const STATUS_ICON: Record<ClaimStatus, typeof Gift> = {
  pending: Clock,
  available: Gift,
  claimed: CheckCircle2,
  expired: Clock,
  failed: AlertTriangle,
  cancelled: Ban,
};

function InboxPage() {
  const { user } = useAuth();
  const uid = user?.id;
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery(playerInboxQuery(uid));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("unclaimed");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reward_inbox_player", uid ?? null] });
    qc.invalidateQueries({ queryKey: ["reward_inbox_all"] });
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "all") return true;
      if (filter === "unclaimed") return r.status === "available" || r.status === "pending";
      return r.status === filter;
    });
  }, [rows, filter]);

  const availableCount = rows.filter((r) => r.status === "available").length;

  const claim = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await sb.rpc("claim_inbox_reward", { p_inbox_id: id });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { toast.success("Reward claimed"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const claimAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc("claim_all_inbox_rewards");
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success(`Claimed ${d?.claimed ?? 0} · Failed ${d?.failed ?? 0}`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider text-primary">
          <Inbox className="h-5 w-5" /> Reward Inbox
        </h1>
        <button
          onClick={() => claimAll.mutate()}
          disabled={availableCount === 0 || claimAll.isPending}
          className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
        >
          Claim all ({availableCount})
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="panel p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          {filter === "unclaimed" ? "No rewards waiting — earn some through quests, events, or daily play." : "Nothing here."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => <InboxCard key={r.id} row={r} onClaim={() => claim.mutate(r.id)} claiming={claim.isPending} />)}
        </ul>
      )}
    </div>
  );
}

function InboxCard({ row, onClaim, claiming }: { row: RewardInboxRow; onClaim: () => void; claiming: boolean }) {
  const Icon = STATUS_ICON[row.status] ?? XCircle;
  const canClaim = row.status === "available";
  const expiresSoon = row.expires_at && new Date(row.expires_at).getTime() - Date.now() < 24 * 3600 * 1000;
  return (
    <li className="panel flex items-center gap-3 p-3">
      <div className={`shrink-0 rounded-full border border-border p-2 ${STATUS_COLOR[row.status]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-sm font-extrabold">{row.reward_name ?? "Unknown reward"}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">×{row.quantity}</span>
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
          {row.source_module ?? "system"} · {row.source_record_name ?? "reward"}
        </div>
        <div className="text-[10px] text-muted-foreground">
          Received {new Date(row.created_at).toLocaleDateString()}
          {row.expires_at ? (
            <span className={`ml-2 ${expiresSoon && canClaim ? "text-amber-500" : ""}`}>
              · Expires {new Date(row.expires_at).toLocaleDateString()}
            </span>
          ) : null}
          {row.claim_error ? <span className="ml-2 text-red-500">· {row.claim_error}</span> : null}
        </div>
      </div>
      {canClaim ? (
        <button
          onClick={onClaim}
          disabled={claiming}
          className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          Claim
        </button>
      ) : (
        <span className={`text-[10px] uppercase tracking-widest ${STATUS_COLOR[row.status]}`}>{row.status}</span>
      )}
    </li>
  );
}
