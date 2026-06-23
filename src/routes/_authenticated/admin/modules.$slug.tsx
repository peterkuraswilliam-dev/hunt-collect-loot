import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { findModule } from "@/modules/registry";
import type { ModuleSectionKey } from "@/modules/contract";

export const Route = createFileRoute("/_authenticated/admin/modules/$slug")({
  component: ModulePage,
});

function ModulePage() {
  const { slug } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mod = findModule(slug);
  const [active, setActive] = useState<ModuleSectionKey>("dashboard");

  if (!mod) {
    return (
      <div className="panel p-6 text-center">
        <p className="font-display text-lg font-bold">Unknown module</p>
        <p className="text-xs text-muted-foreground">No module registered for slug "{slug}".</p>
        <Link to="/admin" className="mt-2 inline-block text-xs text-primary underline">Back to CMS</Link>
      </div>
    );
  }

  const section = mod.sections.find((s) => s.key === active) ?? mod.sections[0];
  const Body = section.component;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link to="/admin" className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3 w-3" /> CMS
        </Link>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Module · {pathname}</p>
      </div>

      <header className="panel-gold flex items-center gap-3 px-4 py-3">
        <mod.icon className="h-6 w-6 text-primary" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Asset OS Module</p>
          <h1 className="font-display text-lg font-extrabold tracking-wide">{mod.name}</h1>
        </div>
      </header>

      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1">
        {mod.sections.map((s) => {
          const isActive = s.key === active;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          );
        })}
      </nav>

      <div>
        <Body />
      </div>
    </div>
  );
}
