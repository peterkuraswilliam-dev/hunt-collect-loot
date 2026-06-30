import { useQuery } from "@tanstack/react-query";
import { SimpleCrud } from "@/modules/_shared/SimpleCrud";
import { progressionTypesQuery, type ProgressionLevel } from "../queries";

export function Levels() {
  const { data: types = [] } = useQuery(progressionTypesQuery);
  return (
    <SimpleCrud<ProgressionLevel>
      table="progression_levels"
      queryKey="progression_levels"
      title="Levels"
      defaults={{ level_number: 1, xp_required: 0, xp_from_previous: 0, status: "active" }}
      fields={[
        {
          key: "progression_type_id",
          label: "Progression Type",
          type: "select",
          options: [{ value: "", label: "— none —" }, ...types.map((t) => ({ value: t.id, label: t.name }))],
        },
        { key: "level_number", label: "Level Number", type: "number" },
        { key: "xp_required", label: "XP Required (total)", type: "number" },
        { key: "xp_from_previous", label: "XP From Previous Level", type: "number" },
        { key: "title", label: "Title" },
        { key: "icon", label: "Icon" },
        { key: "notes", label: "Notes", type: "textarea" },
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
      ]}
    />
  );
}
