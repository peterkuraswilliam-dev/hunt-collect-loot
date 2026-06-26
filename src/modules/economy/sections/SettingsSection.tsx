import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { moduleSettingsQuery } from "@/modules/assets/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function SettingsSection() {
  const qc = useQueryClient();
  const { data } = useQuery(moduleSettingsQuery("economy"));
  const [text, setText] = useState("{}");
  useEffect(() => { setText(JSON.stringify(data?.settings ?? {}, null, 2)); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const settings = JSON.parse(text);
      const { error } = await sb.from("module_settings").upsert({ module: "economy", settings });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["module_settings", "economy"] }),
  });

  return (
    <div className="space-y-3">
      <Field label="Economy module settings (JSON)">
        <textarea rows={10} className={`${inputCls} font-mono text-[11px]`} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {save.error && <p className="text-xs text-destructive">{(save.error as Error).message}</p>}
    </div>
  );
}
