import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { modulePermissionsQuery } from "@/modules/assets/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ROLES = ["admin", "business_owner", "user"] as const;
const CAPS = ["view", "manage", "configure"] as const;

export function Permissions() {
  const qc = useQueryClient();
  const { data: perms = [] } = useQuery(modulePermissionsQuery("collections"));

  async function toggle(role: string, capability: string, on: boolean) {
    if (on) {
      await sb.from("module_permissions").insert({ module: "collections", role, capability });
    } else {
      await sb.from("module_permissions").delete().eq("module", "collections").eq("role", role).eq("capability", capability);
    }
    qc.invalidateQueries({ queryKey: ["module_permissions", "collections"] });
  }
  const has = (role: string, cap: string) => perms.some((p) => p.role === role && p.capability === cap);

  return (
    <div className="panel p-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
            <th className="text-left p-1">Role</th>
            {CAPS.map((c) => <th key={c} className="p-1">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {ROLES.map((r) => (
            <tr key={r} className="border-t border-border/40">
              <td className="p-1 font-semibold">{r}</td>
              {CAPS.map((c) => (
                <td key={c} className="p-1 text-center">
                  <input type="checkbox" checked={has(r, c)} onChange={(e) => toggle(r, c, e.target.checked)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
