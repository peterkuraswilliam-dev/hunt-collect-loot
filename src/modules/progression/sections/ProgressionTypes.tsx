import { useQuery } from "@tanstack/react-query";
import { SimpleCrud } from "@/modules/_shared/SimpleCrud";
import { xpCurvesQuery, type ProgressionType } from "../queries";

export function ProgressionTypes() {
  const { data: curves = [] } = useQuery(xpCurvesQuery);
  return (
    <SimpleCrud<ProgressionType>
      table="progression_types"
      queryKey="progression_types"
      title="Progression Types"
      defaults={{ status: "active", visible: true, max_level: 100, sort_order: 0, xp_display_name: "XP" }}
      fields={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "description", label: "Description", type: "textarea" },
        { key: "icon", label: "Icon" },
        { key: "xp_display_name", label: "XP Display Name" },
        { key: "max_level", label: "Maximum Level", type: "number" },
        {
          key: "default_curve_id",
          label: "Default XP Curve",
          type: "select",
          options: [{ value: "", label: "— none —" }, ...curves.map((c) => ({ value: c.id, label: c.name }))],
        },
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
        {
          key: "visible",
          label: "Visible",
          type: "select",
          options: [
            { value: "true", label: "Visible" },
            { value: "false", label: "Hidden" },
          ],
        },
        { key: "sort_order", label: "Sort Order", type: "number" },
      ]}
    />
  );
}
