import { Sparkles } from "lucide-react";

export function Progression() {
  return (
    <div className="panel-gold space-y-3 p-6 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-primary" />
      <h2 className="font-display text-lg font-extrabold uppercase tracking-wider">
        Experience &amp; Progression
      </h2>
      <p className="text-sm text-muted-foreground">
        The legacy XP system has been removed. A new CMS-driven Experience &amp; Progression
        module is coming soon — level curves, XP sources, and player progression will all be
        configured here.
      </p>
      <p className="text-[11px] uppercase tracking-widest text-primary">Coming soon</p>
    </div>
  );
}
