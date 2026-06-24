import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const EVENTS = ["collection_started", "milestone_reached", "collection_completed"];

const rulesQuery = queryOptions({
  queryKey: ["automation_rules", "collections"],
  queryFn: async () => {
    const { data, error } = await sb.from("automation_rules").select("*").eq("module", "collections").order("created_at");
    if (error) throw error;
    return data ?? [];
  },
});

export function Automation() {
  const qc = useQueryClient();
  const { data: rules = [] } = useQuery(rulesQuery);
  const [name, setName] = useState("");
  const [event, setEvent] = useState(EVENTS[0]);

  async function add() {
    if (!name.trim()) return;
    const { error } = await sb.from("automation_rules").insert({
      module: "collections", name, enabled: true,
      trigger: { event }, action: { type: "noop" },
    });
    if (error) return toast.error(error.message);
    setName("");
    qc.invalidateQueries({ queryKey: ["automation_rules", "collections"] });
  }

  async function toggle(id: string, enabled: boolean) {
    await sb.from("automation_rules").update({ enabled }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["automation_rules", "collections"] });
  }
  async function remove(id: string) {
    await sb.from("automation_rules").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["automation_rules", "collections"] });
  }

  return (
    <div className="space-y-3">
      <div className="panel p-3 space-y-2">
        <input className="input w-full" placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="input w-full" value={event} onChange={(e) => setEvent(e.target.value)}>
          {EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        <button className="btn-primary w-full" onClick={add}><Plus className="h-4 w-4" /> Add rule</button>
      </div>

      <div className="panel divide-y divide-border">
        {rules.map((r: { id: string; name: string; enabled: boolean; trigger: { event?: string } }) => (
          <div key={r.id} className="flex items-center gap-2 p-2 text-sm">
            <input type="checkbox" checked={r.enabled} onChange={(e) => toggle(r.id, e.target.checked)} />
            <div className="flex-1">
              <p className="font-semibold">{r.name}</p>
              <p className="text-[10px] text-muted-foreground">on {r.trigger?.event ?? "—"}</p>
            </div>
            <button className="btn-secondary" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {rules.length === 0 && <p className="p-3 text-xs text-muted-foreground">No rules.</p>}
      </div>
    </div>
  );
}
