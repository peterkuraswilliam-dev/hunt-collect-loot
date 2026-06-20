import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { Field, inputCls } from "@/components/admin/AdminTable";

export const Route = createFileRoute("/_authenticated/admin/economy")({
  component: EconomyAdmin,
});

function EconomyAdmin() {
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const [form, setForm] = useState<{
    energy_max: number;
    energy_regen_seconds: number;
    dig_energy_cost: number;
    grid_size: number;
    xp_per_level: number;
    treasure_rewards: string;
  } | null>(null);

  useEffect(() => {
    if (settings && !form) {
      setForm({
        energy_max: settings.energy_max,
        energy_regen_seconds: settings.energy_regen_seconds,
        dig_energy_cost: settings.dig_energy_cost,
        grid_size: settings.grid_size,
        xp_per_level: settings.xp_per_level,
        treasure_rewards: JSON.stringify(settings.treasure_rewards, null, 2),
      });
    }
  }, [settings, form]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      let rewards: unknown;
      try {
        rewards = JSON.parse(form.treasure_rewards);
      } catch {
        throw new Error("Treasure rewards is not valid JSON");
      }
      const { error } = await supabase
        .from("game_settings")
        .update({
          energy_max: form.energy_max,
          energy_regen_seconds: form.energy_regen_seconds,
          dig_energy_cost: form.dig_energy_cost,
          grid_size: form.grid_size,
          xp_per_level: form.xp_per_level,
          treasure_rewards: rewards as never,
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  if (!form) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3">
      <section className="panel space-y-3 p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Energy & XP</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Energy Max"><input type="number" className={inputCls} value={form.energy_max} onChange={(e) => setForm({ ...form, energy_max: Number(e.target.value) })} /></Field>
          <Field label="Regen Seconds"><input type="number" className={inputCls} value={form.energy_regen_seconds} onChange={(e) => setForm({ ...form, energy_regen_seconds: Number(e.target.value) })} /></Field>
          <Field label="Dig Energy Cost"><input type="number" className={inputCls} value={form.dig_energy_cost} onChange={(e) => setForm({ ...form, dig_energy_cost: Number(e.target.value) })} /></Field>
          <Field label="Grid Size"><input type="number" className={inputCls} value={form.grid_size} onChange={(e) => setForm({ ...form, grid_size: Number(e.target.value) })} /></Field>
          <Field label="XP per Level"><input type="number" className={inputCls} value={form.xp_per_level} onChange={(e) => setForm({ ...form, xp_per_level: Number(e.target.value) })} /></Field>
        </div>
      </section>

      <section className="panel space-y-2 p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Treasure Hunt Rewards</h3>
        <p className="text-[11px] text-muted-foreground">
          JSON array of weighted rewards. Types: <code>empty</code>, <code>credits</code> (min/max), <code>xp</code> (min/max),
          <code> asset</code> (rarity_weights), <code>pack</code> (pack_slug).
        </p>
        <textarea
          rows={14}
          className={`${inputCls} font-mono text-[11px]`}
          value={form.treasure_rewards}
          onChange={(e) => setForm({ ...form, treasure_rewards: e.target.value })}
        />
      </section>

      <button disabled={save.isPending} onClick={() => save.mutate()} className="btn-gold inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm">
        <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save Settings"}
      </button>
      {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
    </div>
  );
}
