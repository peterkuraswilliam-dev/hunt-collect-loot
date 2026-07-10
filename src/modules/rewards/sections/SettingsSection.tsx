import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { moduleSettingsQuery } from "@/modules/assets/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type RewardsSettings = {
  module_enabled: boolean;
  allow_duplicate_rewards: boolean;
  enable_reward_logging: boolean;
  default_claim_behavior: "auto" | "manual" | "queued";
  default_reward_expiry_hours: number;
  default_currency_precision: number;
};

const DEFAULTS: RewardsSettings = {
  module_enabled: true,
  allow_duplicate_rewards: true,
  enable_reward_logging: true,
  default_claim_behavior: "auto",
  default_reward_expiry_hours: 0,
  default_currency_precision: 0,
};

export function SettingsSection() {
  const qc = useQueryClient();
  const { data } = useQuery(moduleSettingsQuery("rewards"));
  const [form, setForm] = useState<RewardsSettings>(DEFAULTS);

  useEffect(() => {
    if (data?.settings) setForm({ ...DEFAULTS, ...(data.settings as Partial<RewardsSettings>) });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("module_settings").upsert({ module: "rewards", settings: form });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["module_settings", "rewards"] }),
  });

  return (
    <div className="space-y-3">
      <div className="panel p-3 space-y-3">
        <label className="flex items-center justify-between text-xs">
          <span className="font-semibold">Module Enabled</span>
          <input type="checkbox" checked={form.module_enabled} onChange={(e) => setForm({ ...form, module_enabled: e.target.checked })} />
        </label>
        <label className="flex items-center justify-between text-xs">
          <span className="font-semibold">Allow Duplicate Rewards</span>
          <input type="checkbox" checked={form.allow_duplicate_rewards} onChange={(e) => setForm({ ...form, allow_duplicate_rewards: e.target.checked })} />
        </label>
        <label className="flex items-center justify-between text-xs">
          <span className="font-semibold">Enable Reward Logging</span>
          <input type="checkbox" checked={form.enable_reward_logging} onChange={(e) => setForm({ ...form, enable_reward_logging: e.target.checked })} />
        </label>

        <Field label="Default Claim Behaviour">
          <select className={inputCls} value={form.default_claim_behavior} onChange={(e) => setForm({ ...form, default_claim_behavior: e.target.value as RewardsSettings["default_claim_behavior"] })}>
            <option value="auto">Auto (grant immediately)</option>
            <option value="manual">Manual (player claims)</option>
            <option value="queued">Queued (pending review)</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Default Reward Expiry (hours, 0 = never)">
            <input type="number" min={0} className={inputCls} value={form.default_reward_expiry_hours} onChange={(e) => setForm({ ...form, default_reward_expiry_hours: Number(e.target.value) })} />
          </Field>
          <Field label="Default Currency Precision (decimals)">
            <input type="number" min={0} max={8} className={inputCls} value={form.default_currency_precision} onChange={(e) => setForm({ ...form, default_currency_precision: Number(e.target.value) })} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
    </div>
  );
}
