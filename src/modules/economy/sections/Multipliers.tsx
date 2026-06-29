import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { multipliersQuery } from "@/lib/queries";
import { Field, inputCls } from "@/components/admin/AdminTable";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Multipliers() {
  const qc = useQueryClient();
  const { data } = useQuery(multipliersQuery);
  const [form, setForm] = useState(data ?? null);
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await sb.from("economy_multipliers").update({
        production_multiplier: form.production_multiplier,
        credits_multiplier: form.credits_multiplier,
        energy_production_multiplier: form.energy_production_multiplier,
        spin_multiplier: form.spin_multiplier,
        max_offline_hours: form.max_offline_hours,
      }).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["multipliers"] }),
  });

  if (!form) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  const num = (k: keyof typeof form) => (
    <input type="number" step="0.1" className={inputCls} value={form[k] as number}
      onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />
  );

  return (
    <div className="space-y-3">
      <section className="panel space-y-3 p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Global multipliers</h3>
        <p className="text-[11px] text-muted-foreground">1.0 = baseline. Collection / Game / Event / Business multipliers stack on top per scope.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="Global Production">{num("production_multiplier")}</Field>
          <Field label="Credits">{num("credits_multiplier")}</Field>
          <Field label="Energy Production">{num("energy_production_multiplier")}</Field>
          <Field label="Spin">{num("spin_multiplier")}</Field>
          <Field label="Max Offline Hours">{num("max_offline_hours")}</Field>
        </div>
      </section>

      <section className="panel space-y-2 p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Scoped multipliers</h3>
        <p className="text-[11px] text-muted-foreground">
          Collection bonuses (Collections module → Bonuses) and per-game/event/business multipliers are configured in their own modules. This screen displays the global baseline used by every scope.
        </p>
        <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
          <li>Collection Multiplier → Collections · Bonuses</li>
          <li>Game Multiplier → Future Games module</li>
          <li>Event Multiplier → Future Events module</li>
          <li>Business Multiplier → Future Businesses module</li>
        </ul>
      </section>

      <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-gold inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm">
        <Save className="h-4 w-4" />{save.isPending ? "Saving…" : "Save Multipliers"}
      </button>
      {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
    </div>
  );
}
