import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { packsQuery, settingsQuery, spinRewardsQuery } from "@/lib/queries";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Balancing() {
  const qc = useQueryClient();
  const { data: packs = [] } = useQuery(packsQuery);
  const { data: spinRewards = [] } = useQuery(spinRewardsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const [xpCurve, setXpCurve] = useState<number | null>(null);
  useEffect(() => { if (settings && xpCurve == null) setXpCurve(settings.xp_per_level); }, [settings, xpCurve]);

  const updatePack = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { price_credits?: number; assets_per_pack?: number } }) => {
      const { error } = await sb.from("packs").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packs"] }),
  });

  const updateSpin = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { min_amount?: number; max_amount?: number; weight?: number } }) => {
      const { error } = await sb.from("spin_rewards").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spin_rewards"] }),
  });

  const saveXp = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("game_settings").update({ xp_per_level: xpCurve }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-primary">Pack prices</h3>
        <AdminTable
          rows={packs}
          empty="No packs."
          columns={[
            { key: "name", label: "Pack", render: (p) => <span className="font-semibold">{p.name}</span> },
            { key: "tier", label: "Tier", render: (p) => <span className="text-muted-foreground">{p.tier}</span> },
            { key: "price", label: "Price (credits)", render: (p) => (
              <input type="number" defaultValue={p.price_credits} className={`${inputCls} h-8 w-24 px-2 py-1 text-xs`}
                onBlur={(e) => updatePack.mutate({ id: p.id, patch: { price_credits: Number(e.target.value) } })} />
            ) },
            { key: "n", label: "Assets / pack", render: (p) => (
              <input type="number" defaultValue={p.assets_per_pack} className={`${inputCls} h-8 w-20 px-2 py-1 text-xs`}
                onBlur={(e) => updatePack.mutate({ id: p.id, patch: { assets_per_pack: Number(e.target.value) } })} />
            ) },
          ]}
        />
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-primary">Reward values (spin)</h3>
        <AdminTable
          rows={spinRewards}
          empty="No spin rewards."
          columns={[
            { key: "label", label: "Reward", render: (r) => <span className="font-semibold">{r.label}</span> },
            { key: "kind", label: "Kind", render: (r) => <span className="text-muted-foreground">{r.kind}</span> },
            { key: "min", label: "Min", render: (r) => (
              <input type="number" defaultValue={r.min_amount} className={`${inputCls} h-8 w-20 px-2 py-1 text-xs`}
                onBlur={(e) => updateSpin.mutate({ id: r.id, patch: { min_amount: Number(e.target.value) } })} />
            ) },
            { key: "max", label: "Max", render: (r) => (
              <input type="number" defaultValue={r.max_amount} className={`${inputCls} h-8 w-20 px-2 py-1 text-xs`}
                onBlur={(e) => updateSpin.mutate({ id: r.id, patch: { max_amount: Number(e.target.value) } })} />
            ) },
            { key: "w", label: "Weight", render: (r) => (
              <input type="number" defaultValue={r.weight} className={`${inputCls} h-8 w-20 px-2 py-1 text-xs`}
                onBlur={(e) => updateSpin.mutate({ id: r.id, patch: { weight: Number(e.target.value) } })} />
            ) },
          ]}
        />
      </section>

      <section className="panel space-y-2 p-4">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-primary">XP curve</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="XP per level"><input type="number" className={inputCls} value={xpCurve ?? 0} onChange={(e) => setXpCurve(Number(e.target.value))} /></Field>
        </div>
        <button onClick={() => saveXp.mutate()} disabled={saveXp.isPending} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {saveXp.isPending ? "Saving…" : "Save XP curve"}
        </button>
      </section>

      <p className="text-[11px] text-muted-foreground">
        Currency inflation is monitored on the Dashboard (credits in circulation). Production rates are edited in the <strong>Production</strong> and <strong>Bulk Utility</strong> tabs.
      </p>
    </div>
  );
}
