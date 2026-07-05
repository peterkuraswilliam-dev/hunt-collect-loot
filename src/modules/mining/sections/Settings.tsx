import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { Switch } from "@/components/ui/switch";
import {
  MINING_MODULE_ID,
  miningSettingsQuery,
  saveMiningSettings,
  type MiningSettings,
  type MiningStatus,
} from "../settings";

const STATUSES: MiningStatus[] = ["enabled", "beta", "maintenance", "disabled"];

const GAMEPLAY: [keyof MiningSettings["gameplay"], string][] = [
  ["auto_mining", "Auto mining"],
  ["critical_hits", "Critical hits"],
  ["random_events", "Random events"],
  ["pickaxe_upgrades", "Pickaxe upgrades"],
  ["xp_rewards", "XP rewards"],
  ["coin_rewards", "Coin rewards"],
  ["energy_system", "Energy system (future)"],
];

const ECONOMY: [keyof MiningSettings["economy"], string][] = [
  ["xp_multiplier", "XP multiplier"],
  ["coin_multiplier", "Coin multiplier"],
  ["loot_multiplier", "Loot multiplier"],
  ["drop_rate_multiplier", "Drop-rate multiplier"],
];

export function MiningSettingsSection() {
  const qc = useQueryClient();
  const { data } = useQuery(miningSettingsQuery);
  const [draft, setDraft] = useState<MiningSettings | null>(null);
  useEffect(() => { if (data) setDraft(data); }, [data]);

  const save = useMutation({
    mutationFn: async (next: MiningSettings) => saveMiningSettings(next),
    onSuccess: () => {
      toast.success("Mining settings saved");
      qc.invalidateQueries({ queryKey: ["module_settings", MINING_MODULE_ID] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!draft) return <div className="panel p-4 text-xs text-muted-foreground">Loading…</div>;

  const patch = (u: Partial<MiningSettings>) => setDraft({ ...draft, ...u });

  return (
    <div className="space-y-4">
      <section className="panel p-3 space-y-3">
        <h3 className="text-[10px] uppercase tracking-widest text-primary">General</h3>
        <Field label="Module status">
          <select
            className={inputCls}
            value={draft.status}
            onChange={(e) => patch({ status: e.target.value as MiningStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <ToggleRow
          label="Show in navigation"
          value={draft.navigation.show_in_nav}
          onChange={(v) => patch({ navigation: { ...draft.navigation, show_in_nav: v } })}
        />
      </section>

      <section className="panel p-3 space-y-3">
        <h3 className="text-[10px] uppercase tracking-widest text-primary">Gameplay</h3>
        {GAMEPLAY.map(([k, label]) => (
          <ToggleRow
            key={k}
            label={label}
            value={draft.gameplay[k]}
            onChange={(v) => patch({ gameplay: { ...draft.gameplay, [k]: v } })}
          />
        ))}
      </section>

      <section className="panel p-3 grid grid-cols-2 gap-3">
        <h3 className="col-span-2 text-[10px] uppercase tracking-widest text-primary">Economy</h3>
        {ECONOMY.map(([k, label]) => (
          <Field key={k} label={label}>
            <input
              type="number"
              step="0.1"
              min={0}
              className={inputCls}
              value={draft.economy[k]}
              onChange={(e) => patch({ economy: { ...draft.economy, [k]: Number(e.target.value) } })}
            />
          </Field>
        ))}
      </section>

      <section className="panel p-3 grid grid-cols-2 gap-3">
        <h3 className="col-span-2 text-[10px] uppercase tracking-widest text-primary">Progression</h3>
        <Field label="Minimum player level">
          <input
            type="number"
            min={1}
            className={inputCls}
            value={draft.progression.min_level}
            onChange={(e) => patch({ progression: { ...draft.progression, min_level: Number(e.target.value) } })}
          />
        </Field>
        <Field label="Unlock requirement (slug)">
          <input
            className={inputCls}
            value={draft.progression.unlock_requirement ?? ""}
            onChange={(e) => patch({ progression: { ...draft.progression, unlock_requirement: e.target.value || null } })}
          />
        </Field>
        <Field label="Daily play limit">
          <input
            type="number"
            min={0}
            className={inputCls}
            value={draft.progression.daily_play_limit ?? ""}
            onChange={(e) =>
              patch({
                progression: {
                  ...draft.progression,
                  daily_play_limit: e.target.value === "" ? null : Number(e.target.value),
                },
              })
            }
          />
        </Field>
      </section>

      <div className="flex justify-end">
        <button
          onClick={() => save.mutate(draft)}
          disabled={save.isPending}
          className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-xs">
      <span>{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  );
}
