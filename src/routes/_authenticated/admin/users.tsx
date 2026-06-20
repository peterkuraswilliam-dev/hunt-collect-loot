import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable } from "@/components/admin/AdminTable";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersAdmin,
});

function UsersAdmin() {
  const qc = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["admin_users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: stats }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, username, avatar_url"),
        supabase.from("user_stats").select("*"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => {
        const s = (stats ?? []).find((x) => x.user_id === p.id);
        const isAdmin = (roles ?? []).some((r) => r.user_id === p.id && r.role === "admin");
        return {
          id: p.id,
          username: p.username,
          credits: s?.credits ?? 0,
          xp: s?.xp ?? 0,
          level: s?.level ?? 1,
          packs_opened: s?.packs_opened ?? 0,
          joined_at: s?.joined_at,
          isAdmin,
        };
      });
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      if (isAdmin) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin_users"] }),
  });

  return (
    <AdminTable
      rows={users}
      empty="No users yet."
      columns={[
        {
          key: "user",
          label: "User",
          render: (r) => (
            <div>
              <div className="font-semibold">{r.username ?? "—"}</div>
              <div className="text-[10px] text-muted-foreground">{r.id.slice(0, 8)}…</div>
            </div>
          ),
        },
        { key: "level", label: "Lv", render: (r) => r.level },
        { key: "credits", label: "Credits", render: (r) => r.credits },
        { key: "packs", label: "Packs", render: (r) => r.packs_opened },
        {
          key: "role",
          label: "Role",
          render: (r) => (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${r.isAdmin ? "bg-primary/20 text-primary" : "bg-surface-2 text-muted-foreground"}`}>
              {r.isAdmin ? "Admin" : "Player"}
            </span>
          ),
        },
        {
          key: "actions",
          label: "",
          className: "text-right",
          render: (r) => (
            <button
              onClick={() => toggleAdmin.mutate({ userId: r.id, isAdmin: r.isAdmin })}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider hover:text-foreground"
            >
              {r.isAdmin ? <><ShieldOff className="h-3 w-3" /> Revoke</> : <><Shield className="h-3 w-3" /> Promote</>}
            </button>
          ),
        },
      ]}
    />
  );
}
