import { ModuleSettingsPanel } from "@/modules/_shared/ModuleSettings";

export function SettingsSection() {
  return (
    <div className="space-y-3">
      <div className="panel p-3 text-xs text-muted-foreground">
        Global Experience &amp; Progression settings. Configure default progression type, XP
        display format, overflow XP behaviour, module status and feature toggles below as JSON.
        Suggested keys: <code>default_progression_type</code>, <code>xp_display_format</code>,
        <code>overflow_behaviour</code>, <code>module_enabled</code>, <code>features</code>.
      </div>
      <ModuleSettingsPanel module="progression" />
    </div>
  );
}
