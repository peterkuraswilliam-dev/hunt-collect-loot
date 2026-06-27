import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { moduleSettingsQuery, modulePermissionsQuery, type ModulePermission } from "@/modules/assets/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function ModuleSettingsPanel({ module }: { module: string }) {
  const qc = useQueryClient();
  const { data } = useQuery(moduleSettingsQuery(module));
  const [text, setText] = useState("{}");
  useEffect(() => { setText(JSON.stringify(data?.settings ?? {}, null, 2)); }, [data]);
  async function save() {
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(text); } catch { return toast.error("Invalid JSON"); }
    const { error } = await sb.from("module_settings").upsert({ module, settings: parsed });
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["module_settings", module] });
  }
  return (
    <div className="panel p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Module settings (JSON)</p>
      <textarea className="input w-full font-mono text-xs" rows={10} value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn-primary w-full" onClick={save}>Save</button>
    </div>
  );
}

const ROLES = ["admin", "business_owner", "user"] as const;
const CAPS = ["view", "manage", "configure"] as const;

export function ModulePermissionsPanel({ module }: { module: string }) {
  const qc = useQueryClient();
  const { data: perms = [] } = useQuery(modulePermissionsQuery(module));
  async function toggle(role: ModulePermission["role"], capability: ModulePermission["capability"], on: boolean) {
    if (on) {
      const { error } = await sb.from("module_permissions").delete().eq("module", module).eq("role", role).eq("capability", capability);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await sb.from("module_permissions").insert({ module, role, capability });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["module_permissions", module] });
  }
  return (
    <div className="panel p-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead><tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground"><th className="py-1">Role</th>{CAPS.map((c) => <th key={c} className="px-2 py-1">{c}</th>)}</tr></thead>
        <tbody>
          {ROLES.map((role) => (
            <tr key={role} className="border-t border-border/40">
              <td className="py-1 font-semibold capitalize">{role.replace("_", " ")}</td>
              {CAPS.map((cap) => {
                const on = perms.some((p) => p.role === role && p.capability === cap);
                return <td key={cap} className="px-2 py-1"><button onClick={() => toggle(role, cap, on)} className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${on ? "border-primary bg-primary/15 text-primary" : "border-border bg-surface-2 text-muted-foreground"}`}>{on ? "On" : "Off"}</button></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
