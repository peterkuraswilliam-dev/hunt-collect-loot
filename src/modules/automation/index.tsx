import { Workflow, Gauge, Zap, GitBranch, Activity, Link2, BarChart3, Settings, ShieldCheck } from "lucide-react";
import type { AssetOSModule } from "../contract";
import { Automation as AssetAutomation } from "../assets/sections/Automation";
import { useQuery } from "@tanstack/react-query";
import { automationRulesQuery } from "../assets/queries";
import { ModuleSettingsPanel, ModulePermissionsPanel } from "../_shared/ModuleSettings";

function Dashboard() {
  const { data: rules = [] } = useQuery(automationRulesQuery);
  const enabled = rules.filter((r) => r.enabled).length;
  const tiles = [
    { label: "Rules", value: rules.length },
    { label: "Enabled", value: enabled },
    { label: "Disabled", value: rules.length - enabled },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className="panel p-3">
          <div className="text-[10px] uppercase tracking-widest text-primary">{t.label}</div>
          <div className="mt-1 font-display text-2xl font-extrabold">{t.value}</div>
        </div>
      ))}
    </div>
  );
}

const Triggers = () => (
  <div className="panel p-3 text-xs space-y-2">
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Available triggers</p>
    <ul className="space-y-1">
      <li>• asset_tagged — when an asset gains tags</li>
      <li>• collection_milestone — when % owned crosses a threshold</li>
      <li>• reward_claimed — when a player claims a reward</li>
      <li>• pack_opened — when a pack is opened</li>
    </ul>
  </div>
);

const Workflows = () => (
  <div className="panel p-3 text-xs text-muted-foreground">Compose multi-step workflows (coming soon). Use the Rules Engine for single-step automations today.</div>
);

const Relationships = () => (
  <div className="panel p-3 text-xs space-y-2">
    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Dynamic relationships</p>
    <p>Assets, collections, packs and games are linked through Tags and Rules — never through hard-coded foreign keys. Adjust tags in the Assets module and rules here to reshape the platform without code.</p>
  </div>
);

const Analytics = () => <div className="panel p-3 text-xs text-muted-foreground">Rule execution analytics coming soon.</div>;

export const automationModule: AssetOSModule = {
  slug: "automation",
  name: "Automation",
  description: "Rules engine, triggers, workflows and dynamic relationships.",
  icon: Workflow,
  sections: [
    { key: "dashboard", label: "Dashboard", icon: Gauge, component: Dashboard },
    { key: "rules", label: "Rules Engine", icon: Zap, component: AssetAutomation },
    { key: "triggers", label: "Triggers", icon: Activity, component: Triggers },
    { key: "workflows", label: "Workflows", icon: GitBranch, component: Workflows },
    { key: "relationships", label: "Relationships", icon: Link2, component: Relationships },
    { key: "analytics", label: "Analytics", icon: BarChart3, component: Analytics },
    { key: "settings", label: "Settings", icon: Settings, component: () => <ModuleSettingsPanel module="automation" /> },
    { key: "permissions", label: "Permissions", icon: ShieldCheck, component: () => <ModulePermissionsPanel module="automation" /> },
  ],
};
