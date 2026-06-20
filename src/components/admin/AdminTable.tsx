import type { ReactNode } from "react";

export function AdminTable<T extends { id: string }>({
  rows,
  columns,
  empty = "Nothing here yet.",
}: {
  rows: T[];
  columns: { key: string; label: string; render: (row: T) => ReactNode; className?: string }[];
  empty?: string;
}) {
  if (!rows.length) return <div className="panel p-6 text-center text-sm text-muted-foreground">{empty}</div>;
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-surface-2 text-[10px] uppercase tracking-widest text-primary">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2 ${c.className ?? ""}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/40 last:border-0">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2 ${c.className ?? ""}`}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
