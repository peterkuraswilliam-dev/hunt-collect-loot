import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { moduleSettingsQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function SettingsSection() {
  const qc = useQueryClient();
  const { data } = useQuery(moduleSettingsQuery("assets"));
  const [json, setJson] = useState("{}");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data) setJson(JSON.stringify(data.settings, null, 2));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      let parsed: unknown;
      try { parsed = JSON.parse(json); } catch (e) { throw new Error((e as Error).message); }
      const { error } = await sb.from("module_settings").upsert({ module: "assets", settings: parsed, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { setErr(null); qc.invalidateQueries({ queryKey: ["module_settings", "assets"] }); },
    onError: (e) => setErr((e as Error).message),
  });

  return (
    <div className="space-y-3">
      <div className="panel-gold p-3">
        <p className="text-xs">Module-level settings (JSON). Examples: <code>default_status</code>, <code>require_image</code>, <code>auto_slug</code>.</p>
      </div>
      <Field label="Settings JSON">
        <textarea rows={14} className={`${inputCls} font-mono text-xs`} value={json} onChange={(e) => setJson(e.target.value)} />
      </Field>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <div className="flex justify-end">
        <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-gold px-4 py-2 text-xs">{save.isPending ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}
