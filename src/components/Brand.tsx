import { Compass } from "lucide-react";

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-xl";
  const icon = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <div className="flex items-center gap-2">
      <div className="grid place-items-center rounded-full bg-gradient-to-br from-amber-500 to-amber-800 p-1.5 shadow-[0_0_18px_oklch(0.82_0.16_80/0.5)]">
        <Compass className={`${icon} text-background`} strokeWidth={2.5} />
      </div>
      <div className={`${text} font-display font-extrabold tracking-[0.15em]`}>
        <span className="text-foreground">ASSET</span>{" "}
        <span className="text-primary">HUNTERS</span>
      </div>
    </div>
  );
}
