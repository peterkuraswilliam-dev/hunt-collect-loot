import { Compass } from "lucide-react";

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-xl";
  const icon = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <div className="brand-lockup group flex items-center gap-3" aria-label="Asset Hunters">
      <div className="brand-crest">
        <span className="brand-crest-orbit" aria-hidden="true" />
        <span className="brand-crest-core">
          <Compass className={`${icon} text-background`} strokeWidth={2.35} />
        </span>
      </div>
      <div className="relative pb-1">
        <div
          className={`${text} brand-wordmark font-display font-black tracking-[0.14em]`}
          data-title="ASSET HUNTERS"
        >
          <span className="brand-wordmark-ivory">ASSET</span>{" "}
          <span className="brand-wordmark-gold">HUNTERS</span>
        </div>
        <div className="brand-rule" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
