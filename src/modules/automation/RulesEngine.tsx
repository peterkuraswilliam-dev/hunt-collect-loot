import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { collectionsQuery } from "@/lib/queries";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import { automationRulesQuery, tagsQuery, type AutomationRule } from "@/modules/assets/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function RulesEngine() {
  const qc = useQueryClient();
  const { data: rules = [] } = useQuery(automationRulesQuery);
  const { data: tags = [] } = useQuery(tagsQuery);
  const { data: collections = [] } = useQuery(collectionsQuery);
  const [editing, setEditing] = useState<Partial<AutomationRule> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<AutomationRule>) => {
      const payload = {
        module: "assets",
        name: row.name!,
        enabled: row.enabled ?? true,
        trigger: row.trigger ?? { event: "asset_tagged", match_tags: [], match_mode: "all" },
        action: row.action ?? { type: "add_to_collection" },
      };
      if (row.id) {
        const { error } = await sb.from("automation_rules").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("automation_rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["automation_rules"] }); setEditing(null); },
  });

  const toggle = useMutation({
    mutationFn: async (row: AutomationRule) => {
      const { error } = await sb.from("automation_rules").update({ enabled: !row.enabled }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation_rules"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("automation_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automation_rules"] }),
  });

  return (
    <div className="space-y-3">
      <div className="panel-gold p-3">
        <p className="text-xs">When an asset gains tags matching a rule, the action runs (e.g. add to a collection). Rules execute server-side via trigger.</p>
      </div>
      <div className="flex justify-end">
        <button onClick={() => setEditing({ name: "", enabled: true, trigger: { event: "asset_tagged", match_tags: [], match_mode: "all" }, action: { type: "add_to_collection" } })} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> New Rule
        </button>
      </div>
      <AdminTable
        rows={rules}
        columns={[
          { key: "name", label: "Name", render: (r) => <span className="font-semibold">{r.name}</span> },
          { key: "trigger", label: "When tags", render: (r) => {
            const ids = r.trigger?.match_tags ?? [];
            const names = ids.map((i) => tags.find((t) => t.id === i)?.name).filter(Boolean);
            return <span className="text-[11px]">{r.trigger?.match_mode ?? "all"}: {names.join(", ") || "—"}</span>;
          } },
          { key: "action", label: "Action", render: (r) => {
            if (r.action?.type === "add_to_collection") {
              const c = collections.find((c) => c.id === r.action.collection_id);
              return <span className="text-[11px]">Add to {c?.name ?? "?"}</span>;
            }
            return r.action?.type ?? "—";
          } },
          { key: "enabled", label: "On", render: (r) => r.enabled ? <span className="text-primary">●</span> : <span className="text-muted-foreground">○</span> },
          {
            key: "actions", label: "", className: "text-right",
            render: (r) => (
              <div className="flex justify-end gap-1">
                <button onClick={() => toggle.mutate(r)} className="rounded p-1 hover:bg-surface-2"><Power className="h-3.5 w-3.5" /></button>
                <button onClick={() => setEditing(r)} className="rounded p-1 hover:bg-surface-2"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => confirm("Delete rule?") && del.mutate(r.id)} className="rounded p-1 text-destructive hover:bg-surface-2"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ),
          },
        ]}
      />
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-2" onClick={() => setEditing(null)}>
          <div className="panel-gold w-full max-w-md space-y-3 overflow-y-auto p-4 max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-base font-bold">{editing.id ? "Edit Rule" : "New Rule"}</h3>
            <Field label="Name"><input className={inputCls} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Match Mode">
              <select className={inputCls} value={editing.trigger?.match_mode ?? "all"} onChange={(e) => setEditing({ ...editing, trigger: { ...editing.trigger, event: "asset_tagged", match_mode: e.target.value as "all" | "any" } })}>
                <option value="all">All tags</option>
                <option value="any">Any tag</option>
              </select>
            </Field>
            <Field label="Match Tags">
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => {
                  const on = editing.trigger?.match_tags?.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => {
                      const cur = new Set(editing.trigger?.match_tags ?? []);
                      if (on) cur.delete(t.id); else cur.add(t.id);
                      setEditing({ ...editing, trigger: { ...editing.trigger, event: "asset_tagged", match_tags: Array.from(cur), match_mode: editing.trigger?.match_mode ?? "all" } });
                    }} className={`rounded-md border px-2 py-0.5 text-[11px] ${on ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface-2"}`}>{t.name}</button>
                  );
                })}
              </div>
            </Field>
            <Field label="Action: Add to Collection">
              <select className={inputCls} value={editing.action?.collection_id ?? ""} onChange={(e) => setEditing({ ...editing, action: { type: "add_to_collection", collection_id: e.target.value || undefined } })}>
                <option value="">— pick a collection —</option>
                {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editing.enabled ?? true} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />
              Enabled
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="flex-1 rounded-md border border-border bg-surface-2 py-2 text-xs font-semibold">Cancel</button>
              <button disabled={!editing.name || save.isPending} onClick={() => save.mutate(editing)} className="btn-gold flex-1 py-2 text-xs disabled:opacity-50">{save.isPending ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
