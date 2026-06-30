import { SimpleCrud } from "@/modules/_shared/SimpleCrud";
import type { XPMultiplier } from "../queries";

export function Multipliers() {
  return (
    <SimpleCrud<XPMultiplier>
      table="xp_multipliers"
      queryKey="xp_multipliers"
      title="XP Multipliers"
      defaults={{ kind: "global", value: 1, priority: 0, stackable: false, status: "active", sort_order: 0 }}
      fields={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        {
          key: "kind",
          label: "Kind",
          type: "select",
          options: [
            { value: "global", label: "Global" },
            { value: "event", label: "Event" },
            { value: "premium", label: "Premium" },
            { value: "guild", label: "Guild" },
            { value: "consumable", label: "Consumable" },
            { value: "realm", label: "Realm" },
            { value: "seasonal", label: "Seasonal" },
          ],
        },
        { key: "value", label: "Multiplier Value", type: "number" },
        { key: "priority", label: "Priority", type: "number" },
        {
          key: "stackable",
          label: "Stackable",
          type: "select",
          options: [
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ],
        },
        { key: "starts_at", label: "Starts At (ISO)" },
        { key: "ends_at", label: "Ends At (ISO)" },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { value: "active", label: "Active" },
            { value: "draft", label: "Draft" },
            { value: "archived", label: "Archived" },
          ],
        },
        { key: "sort_order", label: "Sort Order", type: "number" },
      ]}
    />
  );
}
