import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { moduleSettingsQuery } from "@/modules/assets/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function SettingsSection() {
  const qc = useQueryClient();
  const { data } = useQuery(moduleSettingsQuery("collections"));
  const [text, setText] = useState("{}");

  useEffect(() => { setText(JSON.stringify(data?.settings ?? {}, null, 2)); }, [data]);

  async function save() {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(text); } catch { return toast.error("Invalid JSON"); }
    const { error } = await sb.from("module_settings").upsert({ module: "collections", settings: parsed });
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["module_settings", "collections"] });
  }

  return (
    <div className="panel p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Module settings (JSON)</p>
      <textarea className="input w-full font-mono text-xs" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn-primary w-full" onClick={save}>Save</button>
    </div>
  );
}
