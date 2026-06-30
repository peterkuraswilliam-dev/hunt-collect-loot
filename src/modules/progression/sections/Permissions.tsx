import { ModulePermissionsPanel } from "@/modules/_shared/ModuleSettings";

export function Permissions() {
  return (
    <div className="space-y-3">
      <div className="panel p-3 text-xs text-muted-foreground">
        Capabilities for the Experience &amp; Progression module: <b>view</b>, <b>manage</b>
        (create / edit / delete), <b>configure</b> (settings, analytics).
      </div>
      <ModulePermissionsPanel module="progression" />
    </div>
  );
}
