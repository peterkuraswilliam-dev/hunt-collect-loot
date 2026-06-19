import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/lib/auth-context";
import { StatBar } from "@/components/StatBar";
import { BottomNav } from "@/components/BottomNav";
import { Brand } from "@/components/Brand";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <AuthProvider>
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
        <header className="flex items-center justify-between px-4 pt-4">
          <Brand size="md" />
        </header>
        <StatBar />
        <main className="flex-1 px-3 pb-4 pt-3">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </AuthProvider>
  );
}
