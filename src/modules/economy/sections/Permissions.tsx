import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { modulePermissionsQuery } from "@/modules/assets/queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ROLES = ["admin", "business_owner"] as const;
const CAPS = ["view", "manage", "configure"] as const;

export function Permissions() {
  const qc = useQueryClient();
  const { data: perms = [] } = useQuery(modulePermissionsQuery("economy"));
  const has = (role: string, cap: string) => perms.some((p) => p.role === role && p.capability === cap);

  const toggle = useMutation({
    mutationFn: async ({ role, cap, on }: { role: string; cap: string; on: boolean }) => {
      if (on) {
        const { error } = await sb.from("module_permissions").insert({ module: "economy", role, capability: cap });
        if (error) throw error;
      } else {
        const { error } = await sb.from("module_permissions").delete().eq("module", "economy").eq("role", role).eq("capability", cap);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["module_permissions", "economy"] }),
  });

  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-widest text-primary">
          <tr><th className="px-3 py-2">Role</th>{CAPS.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr>
        </thead>
        <tbody>
          {ROLES.map((r) => (
            <tr key={r} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2 font-semibold capitalize">{r.replace("_", " ")}</td>
              {CAPS.map((c) => (
                <td key={c} className="px-3 py-2">
                  <input type="checkbox" checked={has(r, c)} onChange={(e) => toggle.mutate({ role: r, cap: c, on: e.target.checked })} className="h-4 w-4 accent-primary" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
