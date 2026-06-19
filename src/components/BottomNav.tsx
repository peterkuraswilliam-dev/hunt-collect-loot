import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Pickaxe, Package, Library, Archive, User } from "lucide-react";

const ITEMS = [
  { to: "/home", label: "Home", Icon: Home },
  { to: "/play", label: "Mini Game", Icon: Pickaxe },
  { to: "/packs", label: "Packs", Icon: Package },
  { to: "/collections", label: "Collections", Icon: Library },
  { to: "/inventory", label: "Inventory", Icon: Archive },
  { to: "/profile", label: "Profile", Icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      className="sticky bottom-0 z-30 mt-4 grid grid-cols-6 gap-1 border-t border-border bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur"
      aria-label="Primary"
    >
      {ITEMS.map(({ to, label, Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-0.5 rounded-md py-1.5 text-[10px] font-semibold uppercase tracking-wider transition ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={`h-5 w-5 ${active ? "drop-shadow-[0_0_10px_var(--gold)]" : ""}`} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
