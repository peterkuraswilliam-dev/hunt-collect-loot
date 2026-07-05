import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Package, Library, Archive, Sparkles, User, Pickaxe } from "lucide-react";
import { miningSettingsQuery } from "@/modules/mining/settings";

type NavItem = { to: string; label: string; Icon: typeof Home };

const BASE_ITEMS: NavItem[] = [
  { to: "/home", label: "Home", Icon: Home },
  { to: "/packs", label: "Packs", Icon: Package },
  { to: "/collections", label: "Sets", Icon: Library },
  { to: "/my-assets", label: "Assets", Icon: Archive },
  { to: "/spin", label: "Spin", Icon: Sparkles },
  { to: "/profile", label: "Me", Icon: User },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: mining } = useQuery(miningSettingsQuery);

  const items: NavItem[] = [...BASE_ITEMS];
  if (mining && mining.status !== "disabled" && mining.navigation.show_in_nav) {
    items.splice(5, 0, { to: "/mining", label: "Mine", Icon: Pickaxe });
  }
  const cols = `grid-cols-${items.length}`;


  return (
    <nav
      className={`sticky bottom-0 z-30 mt-4 grid ${cols} gap-0.5 border-t border-border bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur`}
      aria-label="Primary"
    >
      {items.map(({ to, label, Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-0.5 rounded-md py-1.5 text-[9px] font-semibold uppercase tracking-wider transition ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? "drop-shadow-[0_0_10px_var(--gold)]" : ""}`} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
