import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { spinsQuery, spinRewardsAllQuery, type SpinWheel, type SpinRewardRow } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const KINDS = ["credits", "energy", "xp", "pack", "asset"] as const;

function WheelRewards({ spinId, rows }: { spinId: string; rows: SpinRewardRow[] }) {
  const qc = useQueryClient();
  const local = rows.filter((r) => r.spin_id === spinId);
  const totalW = local.reduce((s, r) => s + (r.active ? r.weight : 0), 0);

  const upsert = useMutation({
    mutationFn: async (r: Partial<SpinRewardRow>) => {
      const { error } = await sb.from("spin_rewards").upsert({ ...r, spin_id: spinId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spin_rewards_all"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("spin_rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spin_rewards_all"] }),
  });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("spin_rewards").insert({ spin_id: spinId, label: "New", kind: "credits", min_amount: 10, max_amount: 50, weight: 10, active: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spin_rewards_all"] }),
  });

  return (
    <div className="space-y-2 border-t border-border bg-surface-2/40 p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-primary">Rewards</div>
        <button onClick={() => add.mutate()} className="btn-gold inline-flex items-center gap-1 px-2 py-1 text-[10px]"><Plus className="h-3 w-3" /> Add</button>
      </div>
      {local.map((r) => (
        <div key={r.id} className="grid grid-cols-12 items-center gap-1 text-xs">
          <input className={`${inputCls} col-span-3`} value={r.label} onChange={(e) => upsert.mutate({ ...r, label: e.target.value })} />
          <select className={`${inputCls} col-span-2`} value={r.kind} onChange={(e) => upsert.mutate({ ...r, kind: e.target.value })}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input type="number" className={`${inputCls} col-span-1`} value={r.min_amount} onChange={(e) => upsert.mutate({ ...r, min_amount: Number(e.target.value) })} />
          <input type="number" className={`${inputCls} col-span-1`} value={r.max_amount} onChange={(e) => upsert.mutate({ ...r, max_amount: Number(e.target.value) })} />
          <input className={`${inputCls} col-span-2`} placeholder="pack_slug / rarity" value={r.pack_slug ?? r.asset_rarity ?? ""} onChange={(e) => {
            if (r.kind === "pack") upsert.mutate({ ...r, pack_slug: e.target.value });
            else if (r.kind === "asset") upsert.mutate({ ...r, asset_rarity: e.target.value });
          }} />
          <input type="number" className={`${inputCls} col-span-1`} value={r.weight} onChange={(e) => upsert.mutate({ ...r, weight: Number(e.target.value) })} />
          <div className="col-span-1 text-center text-[10px] text-muted-foreground">{totalW ? Math.round((r.weight / totalW) * 100) : 0}%</div>
          <button onClick={() => del.mutate(r.id)} className="col-span-1 rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3 w-3" /></button>
        </div>
      ))}
      {!local.length && <p className="text-[10px] text-muted-foreground">No rewards yet.</p>}
    </div>
  );
}

export function Spins() {
  const qc = useQueryClient();
  const { data: spins = [] } = useQuery(spinsQuery);
  const { data: rewards = [] } = useQuery(spinRewardsAllQuery);
  const [editing, setEditing] = useState<Partial<SpinWheel> | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<SpinWheel>) => {
      const payload = {
        slug: row.slug!,
        name: row.name!,
        description: row.description ?? null,
        cooldown_seconds: row.cooldown_seconds ?? 0,
        daily_limit: row.daily_limit ?? 0,
        status: row.status ?? "active",
        sort_order: row.sort_order ?? 0,
      };
      if (row.id) {
        const { error } = await sb.from("spins").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("spins").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["spins"] }); setEditing(null); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("spins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spins"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setEditing({ status: "active", sort_order: spins.length })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Spin Wheel
        </button>
      </div>

      <div className="space-y-2">
        {spins.map((s) => (
          <div key={s.id} className="panel overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="text-muted-foreground">
                {expanded === s.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <div className="flex-1">
                <div className="font-display text-sm font-bold">{s.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">cooldown {s.cooldown_seconds}s · daily {s.daily_limit || "∞"} · {s.status}</div>
              </div>
              <button onClick={() => setEditing(s)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => confirm(`Delete ${s.name}?`) && del.mutate(s.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            {expanded === s.id && <WheelRewards spinId={s.id} rows={rewards} />}
          </div>
        ))}
        {!spins.length && <div className="panel p-6 text-center text-sm text-muted-foreground">No spin wheels yet.</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-2 sm:items-center" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-md space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Spin" : "New Spin"}</h3>
            <Field label="Slug"><input className={inputCls} value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></Field>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Description"><textarea rows={2} className={inputCls} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cooldown (s)"><input type="number" className={inputCls} value={editing.cooldown_seconds ?? 0} onChange={(e) => setEditing({ ...editing, cooldown_seconds: Number(e.target.value) })} /></Field>
              <Field label="Daily limit"><input type="number" className={inputCls} value={editing.daily_limit ?? 0} onChange={(e) => setEditing({ ...editing, daily_limit: Number(e.target.value) })} /></Field>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={save.isPending || !editing.slug || !editing.name} onClick={() => save.mutate(editing)} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
