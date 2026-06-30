import { SimpleCrud } from "@/modules/_shared/SimpleCrud";
import type { XPSource } from "../queries";

export function XPSources() {
  return (
    <SimpleCrud<XPSource>
      table="xp_sources"
      queryKey="xp_sources"
      title="XP Sources"
      defaults={{ category: "general", enabled: true, base_xp: 0, scaling_enabled: false, cooldown_seconds: 0, min_level: 1, sort_order: 0 }}
      fields={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "description", label: "Description", type: "textarea" },
        {
          key: "category",
          label: "Category",
          type: "select",
          options: [
            { value: "general", label: "General" },
            { value: "combat", label: "Combat" },
            { value: "quest", label: "Quest" },
            { value: "crafting", label: "Crafting" },
            { value: "social", label: "Social" },
            { value: "exploration", label: "Exploration" },
            { value: "economy", label: "Economy" },
            { value: "event", label: "Event" },
          ],
        },
        {
          key: "enabled",
          label: "Enabled",
          type: "select",
          options: [
            { value: "true", label: "Enabled" },
            { value: "false", label: "Disabled" },
          ],
        },
        { key: "base_xp", label: "Base XP", type: "number" },
        {
          key: "scaling_enabled",
          label: "Scaling Enabled",
          type: "select",
          options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ],
        },
        { key: "daily_cap", label: "Daily Cap", type: "number" },
        { key: "weekly_cap", label: "Weekly Cap", type: "number" },
        { key: "cooldown_seconds", label: "Cooldown (s)", type: "number" },
        { key: "min_level", label: "Minimum Level", type: "number" },
        { key: "max_level", label: "Maximum Level", type: "number" },
        { key: "sort_order", label: "Sort Order", type: "number" },
      ]}
    />
  );
}
