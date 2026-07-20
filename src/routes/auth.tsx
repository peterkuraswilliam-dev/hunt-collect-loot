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
    <div className="auth-scene relative min-h-screen overflow-hidden bg-background">
      <img
        src={heroImg}
        alt=""
        className="auth-backdrop absolute inset-0 h-full w-full object-cover"
      />
      <div className="auth-grade absolute inset-0" />
      <div className="auth-vignette absolute inset-0" />
      <div className="auth-light auth-light-left" aria-hidden="true" />
      <div className="auth-light auth-light-right" aria-hidden="true" />
      <div className="auth-horizon absolute inset-x-0 bottom-0" aria-hidden="true" />
      <div className="auth-shell relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <Brand size="lg" />
        <p className="mt-2 text-center text-sm uppercase tracking-[0.3em] text-primary/80">
          Collect · Play · Own
        </p>

        <form onSubmit={submit} className="auth-card mt-9 w-full space-y-4 p-6">
          <span className="auth-card-rivet auth-card-rivet-left" aria-hidden="true" />
          <span className="auth-card-rivet auth-card-rivet-right" aria-hidden="true" />
          <h1 className="auth-title font-display text-xl font-bold">
            {mode === "signin" ? "Welcome back, hunter" : "Begin your hunt"}
          </h1>
          <div className="space-y-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="auth-field w-full px-4 py-3 text-sm outline-none"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="auth-field w-full px-4 py-3 text-sm outline-none"
            />
          </div>
          <button type="submit" disabled={busy} className="auth-primary w-full py-3 text-sm">
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
          <div className="auth-divider relative my-2 text-center text-xs uppercase tracking-widest">
            <span className="relative z-10 px-3">or</span>
          </div>
          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="auth-secondary w-full py-3 text-sm font-semibold"
          >
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="auth-switch block w-full pt-1 text-center text-xs underline-offset-4"
          >
            {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
