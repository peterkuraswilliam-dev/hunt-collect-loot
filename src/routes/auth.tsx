import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Brand } from "@/components/Brand";
import heroImg from "@/assets/hero-harbour.jpg";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);

    const isLocalDevelopment = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

    if (isLocalDevelopment) {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        toast.error("Missing VITE_SUPABASE_URL");
        setBusy(false);
        return;
      }

      const authorizeUrl = new URL("/auth/v1/authorize", supabaseUrl);
      authorizeUrl.searchParams.set("provider", "google");
      authorizeUrl.searchParams.set("redirect_to", window.location.origin);
      window.location.href = authorizeUrl.toString();
      return;
    }

    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      toast.error(res.error.message);
      setBusy(false);
      return;
    }
    if (res.redirected) return;
    navigate({ to: "/home" });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <img
        src={heroImg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-[var(--gradient-hero)]" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <Brand size="lg" />
        <p className="mt-2 text-center text-sm uppercase tracking-[0.3em] text-primary/80">
          Collect · Play · Own
        </p>

        <form onSubmit={submit} className="panel-gold mt-8 w-full space-y-3 p-5">
          <h1 className="font-display text-xl font-bold">
            {mode === "signin" ? "Welcome back, hunter" : "Begin your hunt"}
          </h1>
          <div className="space-y-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-md border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <button type="submit" disabled={busy} className="btn-gold w-full py-2.5 text-sm">
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <div className="relative my-2 text-center text-xs uppercase tracking-widest text-muted-foreground">
            <span className="bg-card px-2 relative z-10">or</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>
          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="w-full rounded-md border border-border bg-surface-2 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="block w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
