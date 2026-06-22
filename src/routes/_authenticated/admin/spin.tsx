import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { spinRewardsQuery } from "@/lib/queries";
import { AdminTable, inputCls } from "@/components/admin/AdminTable";
import type { SpinReward } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin/spin")({ component: SpinAdmin });

const KINDS = ["credits", "energy", "xp", "pack", "asset"] as const;

function SpinAdmin() {
  const qc = useQueryClient();
  const { data: rewards = [] } = useQuery(spinRewardsQuery);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const upsert = useMutation({
    mutationFn: async (row: Partial<SpinReward> & { id?: string }) => {
      const { error } = await sb.from("spin_rewards").upsert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spin_rewards"] }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("spin_rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spin_rewards"] }),
  });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("spin_rewards").insert({
        label: "New Reward",
        kind: "credits",
        min_amount: 10,
        max_amount: 10,
        weight: 1,
        icon: "🎁",
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spin_rewards"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Spin Rewards</h2>
        <button onClick={() => create.mutate()} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      <AdminTable
        rows={rewards}
        empty="No spin rewards configured."
        columns={[
          {
            key: "icon",
            label: "Icon",
            render: (r) => (
              <input className={inputCls} defaultValue={r.icon ?? ""} onBlur={(e) => upsert.mutate({ id: r.id, icon: e.target.value })} />
            ),
          },
          {
            key: "label",
            label: "Label",
            render: (r) => (
              <input className={inputCls} defaultValue={r.label} onBlur={(e) => upsert.mutate({ id: r.id, label: e.target.value })} />
            ),
          },
          {
            key: "kind",
            label: "Kind",
            render: (r) => (
              <select className={inputCls} defaultValue={r.kind} onChange={(e) => upsert.mutate({ id: r.id, kind: e.target.value as SpinReward["kind"] })}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            ),
          },
          {
            key: "min",
            label: "Min",
            render: (r) => (
              <input type="number" className={inputCls} defaultValue={r.min_amount} onBlur={(e) => upsert.mutate({ id: r.id, min_amount: Number(e.target.value) })} />
            ),
          },
          {
            key: "max",
            label: "Max",
            render: (r) => (
              <input type="number" className={inputCls} defaultValue={r.max_amount} onBlur={(e) => upsert.mutate({ id: r.id, max_amount: Number(e.target.value) })} />
            ),
          },
          {
            key: "extra",
            label: "Pack / Rarity",
            render: (r) => (
              <input
                className={inputCls}
                defaultValue={r.pack_slug ?? r.asset_rarity ?? ""}
                placeholder={r.kind === "pack" ? "pack slug" : r.kind === "asset" ? "rarity" : "—"}
                onBlur={(e) => {
                  const v = e.target.value || null;
                  upsert.mutate({
                    id: r.id,
                    pack_slug: r.kind === "pack" ? v : null,
                    asset_rarity: r.kind === "asset" ? v : null,
                  });
                }}
              />
            ),
          },
          {
            key: "weight",
            label: "Weight",
            render: (r) => (
              <input type="number" className={inputCls} defaultValue={r.weight} onBlur={(e) => upsert.mutate({ id: r.id, weight: Number(e.target.value) })} />
            ),
          },
          {
            key: "active",
            label: "On",
            render: (r) => (
              <input type="checkbox" defaultChecked={r.active} onChange={(e) => upsert.mutate({ id: r.id, active: e.target.checked })} />
            ),
          },
          {
            key: "del",
            label: "",
            render: (r) => (
              <button onClick={() => remove.mutate(r.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
