import { useQuery } from "@tanstack/react-query";
import { SimpleCrud } from "@/modules/_shared/SimpleCrud";
import { xpCurvesQuery, type XPCurve } from "../queries";

function curvePoints(c: XPCurve, count = 20) {
  const pts: number[] = [];
  for (let i = 1; i <= count; i++) {
    let v = c.base_xp;
    if (c.growth_type === "linear") v = c.base_xp * i;
    else if (c.growth_type === "exponential") v = c.base_xp * Math.pow(c.growth_multiplier || 1.15, i - 1);
    else if (c.growth_type === "polynomial") v = c.base_xp * Math.pow(i, c.growth_multiplier || 2);
    else v = c.base_xp + (c.growth_multiplier || 1) * (i - 1);
    pts.push(Math.round(v));
  }
  return pts;
}

function Preview({ curve }: { curve: XPCurve }) {
  const pts = curvePoints(curve);
  const max = Math.max(...pts, 1);
  const w = 220;
  const h = 60;
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * w} ${h - (p / max) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="text-primary">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function XPCurves() {
  const { data: curves = [] } = useQuery(xpCurvesQuery);
  return (
    <div className="space-y-3">
      <SimpleCrud<XPCurve>
        table="xp_curves"
        queryKey="xp_curves"
        title="XP Curves"
        defaults={{ growth_type: "linear", base_xp: 100, growth_multiplier: 1.15, max_level: 100, status: "active", version: 1 }}
        fields={[
          { key: "name", label: "Name" },
          { key: "slug", label: "Slug" },
          { key: "description", label: "Description", type: "textarea" },
          {
            key: "growth_type",
            label: "Growth Type",
            type: "select",
            options: [
              { value: "linear", label: "Linear" },
              { value: "exponential", label: "Exponential" },
              { value: "polynomial", label: "Polynomial" },
              { value: "custom", label: "Custom" },
            ],
          },
          { key: "base_xp", label: "Base XP", type: "number" },
          { key: "growth_multiplier", label: "Growth Multiplier", type: "number" },
          { key: "max_level", label: "Maximum Level", type: "number" },
          { key: "version", label: "Version", type: "number" },
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
      <div className="panel p-3">
        <p className="mb-2 text-[10px] uppercase tracking-widest text-primary">Curve Previews</p>
        {curves.length === 0 ? (
          <p className="text-xs text-muted-foreground">No curves yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {curves.map((c) => (
              <div key={c.id} className="rounded-md border border-border bg-surface-2 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.growth_type}</span>
                </div>
                <Preview curve={c} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
