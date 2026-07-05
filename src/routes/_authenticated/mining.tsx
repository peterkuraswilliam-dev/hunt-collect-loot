import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { AlertTriangle, Wrench, ArrowLeft } from "lucide-react";
import { miningSettingsQuery, MINING_MODULE_VERSION } from "@/modules/mining/settings";

const MiningGame = lazy(() => import("@/modules/mining/runtime/MiningGame"));

export const Route = createFileRoute("/_authenticated/mining")({
  head: () => ({
    meta: [
      { title: "Mining — Asset Realms" },
      { name: "description", content: "Modular Mining mini game." },
    ],
  }),
  component: MiningRoute,
});

function MiningRoute() {
  const { data: settings, isLoading } = useQuery(miningSettingsQuery);

  if (isLoading || !settings) {
    return <div className="panel p-6 text-center text-xs text-muted-foreground">Loading Mining…</div>;
  }

  if (settings.status === "disabled") {
    return (
      <div className="panel p-6 text-center space-y-2">
        <AlertTriangle className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="font-display text-lg font-bold">Mining is currently unavailable</p>
        <p className="text-xs text-muted-foreground">Your progress and inventory are preserved.</p>
        <Link to="/home" className="inline-flex items-center gap-1 text-xs text-primary">
          <ArrowLeft className="h-3 w-3" /> Back home
        </Link>
      </div>
    );
  }

  if (settings.status === "maintenance") {
    return (
      <div className="panel p-6 text-center space-y-2">
        <Wrench className="mx-auto h-6 w-6 text-amber-400" />
        <p className="font-display text-lg font-bold">Mining is in maintenance</p>
        <p className="text-xs text-muted-foreground">We'll be back soon. All saved data is intact.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <header className="panel-gold flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Mini Game</p>
          <h1 className="font-display text-lg font-extrabold tracking-wide">Mining</h1>
        </div>
        {settings.status === "beta" && (
          <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-400">
            Beta v{MINING_MODULE_VERSION}
          </span>
        )}
      </header>
      <Suspense fallback={<div className="panel p-6 text-center text-xs text-muted-foreground">Loading game runtime…</div>}>
        <MiningGame settings={settings} />
      </Suspense>
    </div>
  );
}
