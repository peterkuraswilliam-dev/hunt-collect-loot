import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw, Ban, Undo2, Play, Gift, Filter } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable } from "@/components/admin/AdminTable";
import { inboxAllQuery, rewardsQuery, type ClaimStatus, type RewardInboxRow } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const STATUSES: ClaimStatus[] = ["available", "claimed", "expired", "failed", "cancelled", "pending"];

const STATUS_STYLE: Record<ClaimStatus, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  available: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  claimed: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  expired: "bg-muted text-muted-foreground border-border",
  failed: "bg-red-500/15 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function ClaimBadge({ status }: { status: ClaimStatus }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

export function PlayerInboxes() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery(inboxAllQuery);
  const { data: rewards = [] } = useQuery(rewardsQuery);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<string>("");
  const [showGrant, setShowGrant] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["reward_inbox_all"] });
    qc.invalidateQueries({ queryKey: ["reward_inbox_player"] });
    qc.invalidateQueries({ queryKey: ["distribution_requests"] });
    qc.invalidateQueries({ queryKey: ["reward_deliveries_all"] });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { available: 0, claimed: 0, expired: 0, failed: 0, cancelled: 0, pending: 0 };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const successRate = useMemo(() => {
    const attempted = counts.claimed + counts.failed;
    return attempted ? Math.round((counts.claimed / attempted) * 100) : 0;
  }, [counts]);

  const avgClaimTime = useMemo(() => {
    const claimed = rows.filter((r) => r.status === "claimed" && r.claimed_at);
    if (claimed.length === 0) return "—";
    const ms = claimed.reduce((s, r) => s + (new Date(r.claimed_at!).getTime() - new Date(r.created_at).getTime()), 0) / claimed.length;
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    if (mins < 1440) return `${Math.round(mins / 60)}h`;
    return `${Math.round(mins / 1440)}d`;
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (fStatus && r.status !== fStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !(r.reward_name ?? "").toLowerCase().includes(s) &&
          !(r.source_module ?? "").toLowerCase().includes(s) &&
          !(r.source_record_name ?? "").toLowerCase().includes(s) &&
          !(r.player_id ?? "").toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [rows, fStatus, search]);

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await sb.rpc("admin_reopen_inbox", { p_inbox_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Reopened"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.rpc("admin_cancel_inbox", { p_inbox_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cancelled"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const retry = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await sb.rpc("admin_retry_failed_claim", { p_inbox_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Retried"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const expire = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc("expire_inbox_rewards");
      if (error) throw error;
      return data;
    },
    onSuccess: (n) => { toast.success(`Expired ${n} rewards`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Stat label="Available" value={counts.available} tone="blue" />
        <Stat label="Claimed" value={counts.claimed} tone="emerald" />
        <Stat label="Expired" value={counts.expired} tone="muted" />
        <Stat label="Failed" value={counts.failed} tone="red" />
        <Stat label="Success Rate" value={`${successRate}%`} tone="emerald" />
        <Stat label="Avg Claim Time" value={avgClaimTime} tone="muted" />
      </div>

      <div className="panel flex flex-wrap items-center gap-2 p-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded border border-border bg-surface-2 pl-7 pr-2 py-1.5 text-xs outline-none focus:border-primary"
            placeholder="Search reward, module, player..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="rounded border border-border bg-surface-2 px-2 py-1.5 text-xs" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setShowGrant(true)}
          className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
        >
          <Gift className="h-3 w-3" /> Grant reward
        </button>
        <button
          onClick={() => expire.mutate()}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:bg-surface-2"
        >
          <Filter className="h-3 w-3" /> Run expiry sweep
        </button>
        <button
          onClick={invalidate}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1.5 text-xs hover:bg-surface-2"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="panel p-6 text-center text-xs text-muted-foreground">Loading…</div>
      ) : (
        <AdminTable<RewardInboxRow>
          rows={filtered}
          empty="No inbox rewards match these filters."
          columns={[
            { key: "reward", label: "Reward", render: (r) => (
              <div>
                <div className="font-semibold truncate">{r.reward_name ?? "—"}</div>
                <div className="text-[10px] text-muted-foreground">×{r.quantity} · {r.reward_type_slug ?? "—"}</div>
              </div>
            )},
            { key: "player", label: "Player", render: (r) => (
              <span className="font-mono text-[10px]">{r.player_id?.slice(0, 8) ?? "—"}</span>
            )},
            { key: "source", label: "Source", render: (r) => (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.source_module ?? "—"}</div>
                <div className="truncate text-xs">{r.source_record_name ?? "—"}</div>
              </div>
            )},
            { key: "received", label: "Received", render: (r) => (
              <span className="text-muted-foreground text-[10px]">{new Date(r.created_at).toLocaleString()}</span>
            )},
            { key: "expires", label: "Expires", render: (r) => (
              <span className="text-muted-foreground text-[10px]">{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—"}</span>
            )},
            { key: "status", label: "Status", render: (r) => <ClaimBadge status={r.status} /> },
            { key: "actions", label: "", render: (r) => (
              <div className="flex justify-end gap-1">
                {r.status === "failed" && (
                  <button title="Retry" onClick={() => retry.mutate(r.id)} className="rounded border border-border p-1 hover:bg-surface-2">
                    <Play className="h-3 w-3" />
                  </button>
                )}
                {r.status === "expired" && (
                  <button title="Reopen" onClick={() => reopen.mutate(r.id)} className="rounded border border-border p-1 hover:bg-surface-2">
                    <Undo2 className="h-3 w-3" />
                  </button>
                )}
                {(r.status === "available" || r.status === "pending" || r.status === "failed") && (
                  <button title="Cancel" onClick={() => cancel.mutate(r.id)} className="rounded border border-border p-1 hover:bg-surface-2">
                    <Ban className="h-3 w-3" />
                  </button>
                )}
              </div>
            )},
          ]}
        />
      )}

      {showGrant && <GrantModal rewards={rewards} onClose={() => setShowGrant(false)} onDone={invalidate} />}
    </div>
  );
}

function GrantModal({
  rewards,
  onClose,
  onDone,
}: {
  rewards: Array<{ id: string; name: string }>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [playerId, setPlayerId] = useState("");
  const [rewardId, setRewardId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [claimMode, setClaimMode] = useState("manual");
  const [expiryKind, setExpiryKind] = useState<"none" | "after_days" | "fixed">("none");
  const [expiryDays, setExpiryDays] = useState(7);
  const [expiryAt, setExpiryAt] = useState("");
  const [note, setNote] = useState("");

  const grant = useMutation({
    mutationFn: async () => {
      const policy =
        expiryKind === "after_days" ? { kind: "after_days", days: expiryDays } :
        expiryKind === "fixed" && expiryAt ? { kind: "fixed", at: new Date(expiryAt).toISOString() } :
        { kind: "none" };
      const { data, error } = await sb.rpc("admin_grant_reward", {
        p_player_id: playerId,
        p_reward_id: rewardId,
        p_quantity: quantity,
        p_claim_mode: claimMode,
        p_expiry_policy: policy,
        p_source_note: note || null,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => { toast.success("Reward granted"); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="panel w-full max-w-md p-4 space-y-3">
        <h3 className="font-display text-sm font-extrabold uppercase tracking-wider">Grant Reward</h3>
        <label className="block text-xs">
          <span className="text-muted-foreground">Player ID</span>
          <input value={playerId} onChange={(e) => setPlayerId(e.target.value)} className="mt-1 w-full rounded border border-border bg-surface-2 px-2 py-1.5 text-xs font-mono" placeholder="uuid" />
        </label>
        <label className="block text-xs">
          <span className="text-muted-foreground">Reward</span>
          <select value={rewardId} onChange={(e) => setRewardId(e.target.value)} className="mt-1 w-full rounded border border-border bg-surface-2 px-2 py-1.5 text-xs">
            <option value="">Select reward…</option>
            {rewards.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs">
            <span className="text-muted-foreground">Quantity</span>
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || 1)} className="mt-1 w-full rounded border border-border bg-surface-2 px-2 py-1.5 text-xs" />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground">Claim mode</span>
            <select value={claimMode} onChange={(e) => setClaimMode(e.target.value)} className="mt-1 w-full rounded border border-border bg-surface-2 px-2 py-1.5 text-xs">
              <option value="instant">Instant delivery</option>
              <option value="manual">Manual claim</option>
              <option value="claim_all">Claim all</option>
              <option value="auto_login">Auto on login</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs">
            <span className="text-muted-foreground">Expiry</span>
            <select value={expiryKind} onChange={(e) => setExpiryKind(e.target.value as typeof expiryKind)} className="mt-1 w-full rounded border border-border bg-surface-2 px-2 py-1.5 text-xs">
              <option value="none">No expiry</option>
              <option value="after_days">After X days</option>
              <option value="fixed">Fixed date</option>
            </select>
          </label>
          {expiryKind === "after_days" && (
            <label className="block text-xs">
              <span className="text-muted-foreground">Days</span>
              <input type="number" min={1} value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value) || 1)} className="mt-1 w-full rounded border border-border bg-surface-2 px-2 py-1.5 text-xs" />
            </label>
          )}
          {expiryKind === "fixed" && (
            <label className="block text-xs">
              <span className="text-muted-foreground">Date</span>
              <input type="datetime-local" value={expiryAt} onChange={(e) => setExpiryAt(e.target.value)} className="mt-1 w-full rounded border border-border bg-surface-2 px-2 py-1.5 text-xs" />
            </label>
          )}
        </div>
        <label className="block text-xs">
          <span className="text-muted-foreground">Note</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded border border-border bg-surface-2 px-2 py-1.5 text-xs" placeholder="Compensation, event grant, etc." />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="rounded border border-border px-3 py-1.5 text-xs">Cancel</button>
          <button
            onClick={() => grant.mutate()}
            disabled={!playerId || !rewardId || grant.isPending}
            className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Grant
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: "blue" | "emerald" | "red" | "muted" }) {
  const map: Record<string, string> = {
    blue: "text-blue-500", emerald: "text-emerald-500", red: "text-red-500", muted: "text-muted-foreground",
  };
  return (
    <div className="panel px-3 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-extrabold ${map[tone]}`}>{value}</div>
    </div>
  );
}
