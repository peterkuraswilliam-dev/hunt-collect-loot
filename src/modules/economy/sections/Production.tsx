import { Utility } from "@/modules/assets/sections/Utility";

export function Production() {
  return (
    <div className="space-y-3">
      <div className="panel-gold p-3">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider">Asset production rates</h3>
        <p className="text-[11px] text-muted-foreground">Configure per-hour Energy, Credits, and XP each asset generates. Global multipliers apply on top.</p>
      </div>
      <Utility />
    </div>
  );
}
