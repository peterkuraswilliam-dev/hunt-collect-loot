import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { modulePermissionsQuery, type ModulePermission } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const ROLES: ModulePermission["role"][] = ["admin", "business_owner", "user"];
const CAPS: ModulePermission["capability"][] = ["view", "manage", "configure"];

export function Permissions() {
  const qc = useQueryClient();
  const { data: perms = [] } = useQuery(modulePermissionsQuery("assets"));

  const has = (role: ModulePermission["role"], cap: ModulePermission["capability"]) =>
    perms.some((p) => p.role === role && p.capability === cap);

  const toggle = useMutation({
    mutationFn: async ({ role, cap }: { role: ModulePermission["role"]; cap: ModulePermission["capability"] }) => {
      const existing = perms.find((p) => p.role === role && p.capability === cap);
      if (existing) {
        const { error } = await sb.from("module_permissions").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("module_permissions").insert({ module: "assets", role, capability: cap });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["module_permissions", "assets"] }),
  });

  return (
    <div className="space-y-3">
      <div className="panel-gold p-3">
        <p className="text-xs"><b>View</b>: open the module. <b>Manage</b>: create/edit assets &amp; tags. <b>Configure</b>: edit types, rarities, automation, settings.</p>
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-widest text-primary">
            <tr>
              <th className="px-3 py-2 text-left">Role</th>
              {CAPS.map((c) => <th key={c} className="px-3 py-2 text-center">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => (
              <tr key={role} className="border-b border-border/40 last:border-0">
                <td className="px-3 py-2 font-semibold uppercase tracking-wider">{role}</td>
                {CAPS.map((cap) => (
                  <td key={cap} className="px-3 py-2 text-center">
                    <input type="checkbox" checked={has(role, cap)} onChange={() => toggle.mutate({ role, cap })} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
