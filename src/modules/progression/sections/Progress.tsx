import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Search, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import {
  allSubjectProgressionQuery,
  demoSubjectsQuery,
  progressionTypesQuery,
  recentLevelUpsQuery,
  subjectProgressionQuery,
  xpAwardLogQuery,
  xpSourcesQuery,
  progressionLevelsQuery,
  type SubjectProgression,
  type XPAwardLogEntry,
} from "../queries";

const PAGE_SIZE = 10;

function pct(cur: number, prev: number, next: number | null): number {
  if (next === null || next <= prev) return 100;
  const span = next - prev;
  const done = Math.max(0, cur - prev);
  return Math.min(100, Math.round((done / span) * 100));
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function Progress() {
  const { data: subjects = [] } = useQuery(demoSubjectsQuery);
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const { data: sources = [] } = useQuery(xpSourcesQuery);
  const { data: levels = [] } = useQuery(progressionLevelsQuery);
  const { data: allProgression = [] } = useQuery(allSubjectProgressionQuery);
  const { data: recentLevelUps = [] } = useQuery(recentLevelUpsQuery);

  const [subjectId, setSubjectId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const activeSubject = subjectId || subjects[0]?.id || "";
  const activeType = typeId || types[0]?.id || "";

  const { data: subjProgress = [] } = useQuery(subjectProgressionQuery(activeSubject || null));
  const { data: log = [] } = useQuery(xpAwardLogQuery(activeSubject || null, activeType || null));

  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const currentProg = subjProgress.find((p) => p.progression_type_id === activeType) as
    | SubjectProgression
    | undefined;

  const levelInfo = useMemo(() => {
    if (!currentProg) return { prev: 0, next: null as number | null };
    const forType = levels.filter((l) => l.progression_type_id === currentProg.progression_type_id);
    const prev =
      forType.find((l) => l.level_number === currentProg.current_level)?.xp_required ?? 0;
    const next =
      forType.find((l) => l.level_number === currentProg.current_level + 1)?.xp_required ?? null;
    return { prev, next };
  }, [currentProg, levels]);

  const filteredLog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return log;
    return log.filter((e: XPAwardLogEntry) => {
      const src = e.xp_source_id ? sourceMap.get(e.xp_source_id)?.name ?? "" : "";
      return (
        src.toLowerCase().includes(q) ||
        (e.note ?? "").toLowerCase().includes(q) ||
        String(e.amount).includes(q)
      );
    });
  }, [log, search, sourceMap]);

  const pageCount = Math.max(1, Math.ceil(filteredLog.length / PAGE_SIZE));
  const pageRows = filteredLog.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totals = useMemo(() => {
    const tracked = allProgression.length;
    const lifetime = allProgression.reduce((a, p) => a + Number(p.lifetime_xp ?? 0), 0);
    const avgLvl =
      allProgression.length > 0
        ? (allProgression.reduce((a, p) => a + p.current_level, 0) / allProgression.length).toFixed(
            1,
          )
        : "0";
    return { tracked, lifetime, avgLvl };
  }, [allProgression]);

  const progress = currentProg ? pct(currentProg.current_xp, levelInfo.prev, levelInfo.next) : 0;

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Tracked records", value: totals.tracked },
          { label: "Lifetime XP", value: totals.lifetime.toLocaleString() },
          { label: "Avg level", value: totals.avgLvl },
          { label: "Recent level-ups", value: recentLevelUps.length },
        ].map((t) => (
          <div key={t.label} className="panel p-3">
            <div className="text-[10px] uppercase tracking-widest text-primary">{t.label}</div>
            <div className="mt-1 font-display text-xl font-extrabold">{t.value}</div>
          </div>
        ))}
      </div>

      {/* Selector */}
      <div className="panel p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Subject">
            <select
              className={inputCls}
              value={activeSubject}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setPage(0);
              }}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Progression Type">
            <select
              className={inputCls}
              value={activeType}
              onChange={(e) => {
                setTypeId(e.target.value);
                setPage(0);
              }}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Progress card */}
      <div className="panel p-4">
        <div className="flex items-center gap-2 text-primary">
          <TrendingUp className="h-4 w-4" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wider">
            Current Progress
          </h3>
        </div>
        {!currentProg ? (
          <p className="mt-3 text-sm text-muted-foreground">No progression recorded yet.</p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Level
              </div>
              <div className="font-display text-3xl font-extrabold">
                {currentProg.current_level}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Current XP
              </div>
              <div className="font-display text-3xl font-extrabold">
                {currentProg.current_xp.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Lifetime XP
              </div>
              <div className="font-display text-3xl font-extrabold">
                {(currentProg.lifetime_xp ?? 0).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Next level XP
              </div>
              <div className="font-display text-3xl font-extrabold">
                {levelInfo.next === null ? "MAX" : levelInfo.next.toLocaleString()}
              </div>
            </div>
            <div className="sm:col-span-4">
              <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                <span>Progress to next level</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Last XP awarded
              </div>
              <div className="text-sm">
                {currentProg.last_awarded_amount ?? "—"}
                <span className="ml-2 text-muted-foreground">
                  {fmtDate(currentProg.last_awarded_at)}
                </span>
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Last level up
              </div>
              <div className="text-sm">{fmtDate(currentProg.last_level_up_at)}</div>
            </div>
          </div>
        )}
      </div>

      {/* XP History */}
      <div className="panel p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">
            XP History
          </h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              className={`${inputCls} pl-7`}
              placeholder="Search source, note, amount"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>
        <AdminTable
          rows={pageRows}
          empty="No XP history for this progression yet."
          columns={[
            { key: "date", label: "Date", render: (r) => fmtDate(r.created_at) },
            {
              key: "src",
              label: "Source",
              render: (r) =>
                r.xp_source_id ? sourceMap.get(r.xp_source_id)?.name ?? "—" : "manual",
            },
            {
              key: "amt",
              label: "Amount",
              render: (r) => (
                <span className={r.amount < 0 ? "text-destructive" : "text-primary"}>
                  {r.amount > 0 ? "+" : ""}
                  {r.amount}
                </span>
              ),
            },
            { key: "xp", label: "XP Δ", render: (r) => `${r.xp_before} → ${r.xp_after}` },
            {
              key: "lvl",
              label: "Level Δ",
              render: (r) =>
                r.leveled_up ? (
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 font-bold text-primary">
                    {r.level_before} → {r.level_after}
                  </span>
                ) : (
                  <span className="text-muted-foreground">{r.level_after}</span>
                ),
            },
            { key: "note", label: "Note", render: (r) => r.note ?? "—" },
          ]}
        />
        <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>
            {filteredLog.length} entries · page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-1">
            <button
              className="rounded border border-border bg-surface-2 px-2 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              className="rounded border border-border bg-surface-2 px-2 py-1 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Recent level ups */}
      <div className="panel p-3">
        <div className="mb-2 flex items-center gap-2 text-primary">
          <Trophy className="h-4 w-4" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wider">
            Recent Level Ups
          </h3>
        </div>
        <AdminTable
          rows={recentLevelUps.slice(0, 15)}
          empty="No level-ups yet."
          columns={[
            { key: "date", label: "Date", render: (r) => fmtDate(r.created_at) },
            {
              key: "sub",
              label: "Subject",
              render: (r) => subjectMap.get(r.subject_id)?.name ?? r.subject_id.slice(0, 8),
            },
            {
              key: "type",
              label: "Type",
              render: (r) => typeMap.get(r.progression_type_id)?.name ?? "—",
            },
            {
              key: "lvl",
              label: "Level",
              render: (r) => (
                <span className="rounded bg-primary/20 px-1.5 py-0.5 font-bold text-primary">
                  {r.level_before} → {r.level_after}
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
