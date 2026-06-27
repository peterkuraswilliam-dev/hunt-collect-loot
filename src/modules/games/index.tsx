import { Gamepad2, Gauge, Database, Joystick, Mountain, MapPin, ToggleLeft, BarChart3, Settings, ShieldCheck } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { useQuery } from "@tanstack/react-query";
import { gamesQuery, miniGamesQuery, realmsQuery, locationsQuery } from "./queries";
import { SimpleCrud } from "../_shared/SimpleCrud";
import { ModuleSettingsPanel, ModulePermissionsPanel } from "../_shared/ModuleSettings";

function Dashboard() {
  const { data: games = [] } = useQuery(gamesQuery);
  const { data: mini = [] } = useQuery(miniGamesQuery);
  const { data: realms = [] } = useQuery(realmsQuery);
  const { data: locs = [] } = useQuery(locationsQuery);
  const tiles = [
    { label: "Games", value: games.length },
    { label: "Mini Games", value: mini.length },
    { label: "Realms", value: realms.length },
    { label: "Locations", value: locs.length },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="panel p-3">
          <div className="text-[10px] uppercase tracking-widest text-primary">{t.label}</div>
          <div className="mt-1 font-display text-2xl font-extrabold">{t.value}</div>
        </div>
      ))}
    </div>
  );
}

const Games = () => (
  <SimpleCrud
    table="games"
    queryKey="games"
    title="Games — tag-driven asset & reward sourcing"
    fields={[
      { key: "name", label: "Name" },
      { key: "slug", label: "Slug" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "icon", label: "Icon" },
      { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }] },
      { key: "sort_order", label: "Order", type: "number" },
    ]}
    defaults={{ status: "active", sort_order: 0 }}
  />
);
const MiniGames = () => (
  <SimpleCrud table="mini_games" queryKey="mini_games" title="Mini Games" fields={[
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }] },
    { key: "sort_order", label: "Order", type: "number" },
  ]} defaults={{ status: "active", sort_order: 0 }} />
);
const Realms = () => (
  <SimpleCrud table="realms" queryKey="realms" title="Realms" fields={[
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "image_url", label: "Image URL" },
    { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }] },
    { key: "sort_order", label: "Order", type: "number" },
  ]} defaults={{ status: "active", sort_order: 0 }} />
);
const Locations = () => (
  <SimpleCrud table="locations" queryKey="locations" title="Locations" fields={[
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug" },
    { key: "description", label: "Description", type: "textarea" },
    { key: "lat", label: "Latitude", type: "number" },
    { key: "lng", label: "Longitude", type: "number" },
    { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }] },
    { key: "sort_order", label: "Order", type: "number" },
  ]} defaults={{ status: "active", sort_order: 0 }} />
);

function EnabledModules() {
  const { data: games = [] } = useQuery(gamesQuery);
  return (
    <div className="panel p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Enabled modules per game</p>
      <p className="text-xs text-muted-foreground">Edit a game to toggle which modules (assets/collections/rewards/economy) are active for it.</p>
      <ul className="space-y-1 text-xs">
        {games.map((g) => (
          <li key={g.id} className="flex items-center justify-between border-b border-border/40 py-1 last:border-0">
            <span className="font-semibold">{g.name}</span>
            <span className="text-muted-foreground">{g.enabled_modules.join(", ") || "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const Analytics = () => <div className="panel p-3 text-xs text-muted-foreground">Game-level analytics coming soon.</div>;

export const gamesModule: AssetOSModule = {
  slug: "games",
  name: "Games",
  description: "Games, mini-games, realms, locations and enabled modules.",
  icon: Gamepad2,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "games", label: "Games", icon: Database, component: Games },
    { key: "mini", label: "Mini Games", icon: Joystick, component: MiniGames },
    { key: "realms", label: "Realms", icon: Mountain, component: Realms },
    { key: "locations", label: "Locations", icon: MapPin, component: Locations },
    { key: "enabled", label: "Enabled Modules", icon: ToggleLeft, component: EnabledModules },
    { key: "analytics", label: "Analytics", icon: BarChart3, component: Analytics },
    { key: "settings", label: "Settings", icon: Settings, component: () => <ModuleSettingsPanel module="games" /> },
    { key: "permissions", label: "Permissions", icon: ShieldCheck, component: () => <ModulePermissionsPanel module="games" /> },
  ],
};
