import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/spin")({ component: SpinComingSoon });

function SpinComingSoon() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="panel-gold w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wider text-primary">
          Spin Wheel
        </h1>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          <Clock className="h-3 w-3" /> Coming Soon
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          The Spin Wheel is being reworked. Keep collecting tokens — you'll be able to
          redeem them when the new experience launches.
        </p>
      </div>
    </div>
  );
}
