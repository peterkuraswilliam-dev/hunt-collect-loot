import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { Field, inputCls } from "@/components/admin/AdminTable";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Energy() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [form, setForm] = useState<{ energy_max: number; energy_regen_seconds: number } | null>(null);

  useEffect(() => {
    if (data && !form) setForm({
      energy_max: data.energy_max, energy_regen_seconds: data.energy_regen_seconds,
    });
  }, [data, form]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await sb.from("game_settings").update(form).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  if (!form) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3">
      <section className="panel space-y-3 p-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">Energy economy</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Max energy"><input type="number" className={inputCls} value={form.energy_max} onChange={(e) => setForm({ ...form, energy_max: Number(e.target.value) })} /></Field>
          <Field label="Regen seconds / point"><input type="number" className={inputCls} value={form.energy_regen_seconds} onChange={(e) => setForm({ ...form, energy_regen_seconds: Number(e.target.value) })} /></Field>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Refill costs and energy rewards are configured via the Rewards module (spin rewards, bundles) and pack pricing in Balancing.
        </p>
      </section>
      <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-gold inline-flex w-full items-center justify-center gap-2 py-2.5 text-sm">
        <Save className="h-4 w-4" />{save.isPending ? "Saving…" : "Save Energy Settings"}
      </button>
      {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
    </div>
  );
}
