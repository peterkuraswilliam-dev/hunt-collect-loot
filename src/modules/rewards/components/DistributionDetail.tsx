import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Play, Ban, CheckCircle2, XCircle, Clock, AlertTriangle, Package, Layers, Dice5, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  distributionActivityQuery,
  rewardsQuery,
  rewardBundlesQuery,
  type DistributionRequest,
} from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const TABS = ["overview", "source", "conditions", "resolved", "errors", "activity"] as const;
type Tab = (typeof TABS)[number];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  processing: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  completed: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-600 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const TYPE_ICON: Record<string, typeof Package> = {
  direct: Zap,
  bundle: Package,
  loot_table: Dice5,
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLE[status] ?? ""}`}>
      {status}
    </span>
  );
}

export function DistributionDetail({ request, onClose }: { request: DistributionRequest; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const { data: activity = [] } = useQuery(distributionActivityQuery(request.id));
  const { data: rewards = [] } = useQuery(rewardsQuery);
  const { data: bundles = [] } = useQuery(rewardBundlesQuery);

  const rewardName = useMemo(() => rewards.find((r) => r.id === request.reward_id)?.name, [rewards, request.reward_id]);
  const bundleName = useMemo(() => bundles.find((b) => b.id === request.reward_bundle_id)?.name, [bundles, request.reward_bundle_id]);

  const process = useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc("process_reward_distribution_request", { p_request_id: request.id });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Request processed");
      qc.invalidateQueries({ queryKey: ["distribution_requests"] });
      qc.invalidateQueries({ queryKey: ["distribution_activity", request.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { error } = await sb.rpc("cancel_reward_distribution_request", { p_request_id: request.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cancelled");
      qc.invalidateQueries({ queryKey: ["distribution_requests"] });
      qc.invalidateQueries({ queryKey: ["distribution_activity", request.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const TypeIcon = TYPE_ICON[request.request_type] ?? Package;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <div className="panel my-8 w-full max-w-4xl overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-3">
          <TypeIcon className="h-4 w-4 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <StatusBadge status={request.status} />
              <span className="truncate text-xs uppercase tracking-widest text-muted-foreground">{request.source_module}</span>
            </div>
            <div className="mt-0.5 truncate font-display text-sm font-extrabold">
              {request.source_record_name ?? "Untitled request"}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground truncate">{request.id}</div>
          </div>
          <div className="flex items-center gap-2">
            {(request.status === "pending" || request.status === "failed") && (
              <>
                <button
                  onClick={() => process.mutate()}
                  disabled={process.isPending}
                  className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Play className="h-3 w-3" /> Process
                </button>
                <button
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-surface-2 disabled:opacity-50"
                >
                  <Ban className="h-3 w-3" /> Cancel
                </button>
              </>
            )}
            <button onClick={onClose} className="rounded p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-border bg-surface-2/50 px-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs uppercase tracking-wider ${
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "resolved" ? "Resolved Rewards" : t}
            </button>
          ))}
        </div>

        <div className="p-4 text-sm">
          {tab === "overview" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Request Type">{request.request_type}</Field>
              <Field label="Status"><StatusBadge status={request.status} /></Field>
              <Field label="Source Module">{request.source_module}</Field>
              <Field label="Source Record">{request.source_record_name ?? "—"}</Field>
              <Field label="Reward Source">
                {request.request_type === "direct" && (rewardName ?? "—")}
                {request.request_type === "bundle" && (bundleName ?? "—")}
                {request.request_type === "loot_table" && (request.loot_table_id ? "Loot table" : "—")}
              </Field>
              <Field label="Quantity">{request.quantity}</Field>
              <Field label="Priority">{request.priority}</Field>
              <Field label="Player">{request.player_id?.slice(0, 8) ?? "—"}</Field>
              <Field label="Created">{new Date(request.created_at).toLocaleString()}</Field>
              <Field label="Processed">{request.processed_at ? new Date(request.processed_at).toLocaleString() : "—"}</Field>
            </div>
          )}

          {tab === "source" && (
            <div className="space-y-3">
              <div className="panel p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Module</div>
                <div className="font-semibold">{request.source_module}</div>
              </div>
              <div className="panel p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Record</div>
                <div className="font-semibold">{request.source_record_name ?? "—"}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{request.source_record_id ?? "—"}</div>
              </div>
              <pre className="panel overflow-auto p-3 text-[11px]">{JSON.stringify(request.metadata, null, 2)}</pre>
            </div>
          )}

          {tab === "conditions" && (
            <div>
              {Object.keys(request.conditions).length === 0 ? (
                <p className="text-xs text-muted-foreground">No conditions attached to this request.</p>
              ) : (
                <pre className="panel overflow-auto p-3 text-[11px]">{JSON.stringify(request.conditions, null, 2)}</pre>
              )}
            </div>
          )}

          {tab === "resolved" && (
            <div>
              {request.resolved_rewards.length === 0 ? (
                <p className="text-xs text-muted-foreground">No rewards resolved yet. Process the request to preview rewards.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {request.resolved_rewards.map((r, i) => (
                    <li key={i} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold truncate">{(r.name as string) ?? "Unknown"}</span>
                        {r.guaranteed ? <span className="ml-2 text-emerald-500">guaranteed</span> : null}
                      </div>
                      <span className="text-muted-foreground tabular-nums">
                        {r.quantity ? `×${r.quantity}` : r.min_quantity && r.max_quantity ? `${r.min_quantity}-${r.max_quantity}` : ""}
                        {r.weight ? ` · w${r.weight}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "errors" && (
            <div>
              {request.error_message ? (
                <div className="panel border-red-500/30 bg-red-500/5 p-3 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-red-600">
                    <AlertTriangle className="h-3 w-3" /> Failure
                  </div>
                  <p className="mt-1 font-mono">{request.error_message}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No errors recorded.</p>
              )}
            </div>
          )}

          {tab === "activity" && (
            <div>
              {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity recorded.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {activity.map((a) => {
                    const Icon = a.action === "completed" ? CheckCircle2 : a.action === "failed" ? XCircle : a.action === "cancelled" ? Ban : Clock;
                    return (
                      <li key={a.id} className="flex items-start gap-2 border-b border-border/40 pb-2 last:border-0">
                        <Icon className="mt-0.5 h-3.5 w-3.5 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold uppercase tracking-wider text-[10px]">{a.action}</div>
                          <div className="text-muted-foreground">
                            {a.actor_label ?? "System"} · {new Date(a.created_at).toLocaleString()}
                          </div>
                          {Object.keys(a.detail ?? {}).length > 0 && (
                            <pre className="mt-1 rounded bg-surface-2 p-1.5 text-[10px]">{JSON.stringify(a.detail, null, 2)}</pre>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold">{children}</div>
    </div>
  );
}
