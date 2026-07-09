import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import {
  demoSubjectsQuery,
  progressionTypesQuery,
  replayXpEvent,
  xpEventsQuery,
  xpSourcesQuery,
  type XPEvent,
  type XPEventStatus,
  type XPEventType,
} from "../queries";

const PAGE_SIZE = 15;

const EVENT_LABEL: Record<XPEventType, string> = {
  xp_awarded: "XP Awarded",
  xp_removed: "XP Removed",
  level_up: "Level Up",
  multi_level_up: "Multi Level Up",
};

const STATUS_CLASS: Record<XPEventStatus, string> = {
  processed: "text-primary",
  failed: "text-destructive",
  replayed: "text-yellow-500",
};

type SortKey = "created_at" | "amount" | "level_after";
type SortDir = "asc" | "desc";

function fmtDate(v: string) {
  return new Date(v).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function Events() {
  const qc = useQueryClient();
  const { data: events = [], isLoading } = useQuery(xpEventsQuery);
  const { data: subjects = [] } = useQuery(demoSubjectsQuery);
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const { data: sources = [] } = useQuery(xpSourcesQuery);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState("");

  const replay = useMutation({
    mutationFn: (id: string) => replayXpEvent(id),
    onSuccess: () => {
      setMessage("Event replayed");
      qc.invalidateQueries({ queryKey: ["xp_events"] });
      qc.invalidateQueries({ queryKey: ["subject_progression"] });
    },
    onError: (e: Error) => setMessage(`Error: ${e.message}`),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = events.filter((e) => {
      if (eventType && e.event_type !== eventType) return false;
      if (status && e.status !== status) return false;
      if (subjectId && e.subject_id !== subjectId) return false;
      if (typeId && e.progression_type_id !== typeId) return false;
      if (!q) return true;
      const subj = subjectMap.get(e.subject_id)?.name?.toLowerCase() ?? "";
      const typ = typeMap.get(e.progression_type_id)?.name?.toLowerCase() ?? "";
      const src = e.xp_source_id ? sourceMap.get(e.xp_source_id)?.name?.toLowerCase() ?? "" : "";
      return (
        subj.includes(q) ||
        typ.includes(q) ||
        src.includes(q) ||
        (e.note ?? "").toLowerCase().includes(q)
      );
    });
    rows.sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [events, search, eventType, status, subjectId, typeId, sortKey, sortDir, subjectMap, typeMap, sourceMap]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const sortIcon = (k: SortKey) =>
    sortKey !== k ? null : sortDir === "asc" ? <ArrowUp className="ml-1 inline h-3 w-3" /> : <ArrowDown className="ml-1 inline h-3 w-3" />;

  const totals = useMemo(() => {
    const t = { total: events.length, processed: 0, failed: 0, replayed: 0, levelUps: 0 };
    for (const e of events) {
      if (e.status === "processed") t.processed++;
      else if (e.status === "failed") t.failed++;
      else if (e.status === "replayed") t.replayed++;
      if (e.event_type === "level_up" || e.event_type === "multi_level_up") t.levelUps++;
    }
    return t;
  }, [events]);

  return (
    <div className="space-y-3">
      <div className="panel-gold flex items-center gap-2 p-3">
        <Activity className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wider">XP Event Log</h2>
          <p className="text-[10px] text-muted-foreground">
            Every XP event routed through the engine. Future modules submit here instead of touching XP directly.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: "Total", value: totals.total },
          { label: "Processed", value: totals.processed },
          { label: "Failed", value: totals.failed },
          { label: "Replayed", value: totals.replayed },
          { label: "Level ups", value: totals.levelUps },
        ].map((s) => (
          <div key={s.label} className="panel p-2 text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
            <div className="font-display text-lg font-extrabold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="panel space-y-2 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                className={`${inputCls} pl-7`}
                placeholder="Player, type, source, note…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
          </Field>
          <Field label="Event type">
            <select className={inputCls} value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(0); }}>
              <option value="">All</option>
              {Object.entries(EVENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
              <option value="">All</option>
              <option value="processed">Processed</option>
              <option value="failed">Failed</option>
              <option value="replayed">Replayed</option>
            </select>
          </Field>
          <Field label="Player">
            <select className={inputCls} value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPage(0); }}>
              <option value="">All</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Progression type">
            <select className={inputCls} value={typeId} onChange={(e) => { setTypeId(e.target.value); setPage(0); }}>
              <option value="">All</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        </div>
        {message && (
          <div className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px]">{message}</div>
        )}
      </div>

      <AdminTable<XPEvent>
        rows={pageRows}
        empty={isLoading ? "Loading events…" : "No XP events match the current filters."}
        columns={[
          {
            key: "when",
            label: (<button onClick={() => toggleSort("created_at")} className="uppercase">Date{sortIcon("created_at")}</button>) as unknown as string,
            render: (r) => <span className="whitespace-nowrap">{fmtDate(r.created_at)}</span>,
          },
          { key: "player", label: "Player", render: (r) => subjectMap.get(r.subject_id)?.name ?? "—" },
          { key: "type", label: "Progression", render: (r) => typeMap.get(r.progression_type_id)?.name ?? "—" },
          { key: "src", label: "XP Source", render: (r) => (r.xp_source_id ? sourceMap.get(r.xp_source_id)?.name ?? "—" : "Manual") },
          {
            key: "event",
            label: "Event",
            render: (r) => (
              <span className="inline-flex items-center gap-1">
                {(r.event_type === "level_up" || r.event_type === "multi_level_up") && <TrendingUp className="h-3 w-3 text-primary" />}
                {EVENT_LABEL[r.event_type]}
              </span>
            ),
          },
          {
            key: "amount",
            label: (<button onClick={() => toggleSort("amount")} className="uppercase">XP{sortIcon("amount")}</button>) as unknown as string,
            render: (r) => (
              <span className={r.amount >= 0 ? "text-primary" : "text-destructive"}>
                {r.amount > 0 ? `+${r.amount}` : r.amount}
              </span>
            ),
          },
          { key: "lvl_before", label: "Prev Lv", render: (r) => r.level_before },
          {
            key: "lvl_after",
            label: (<button onClick={() => toggleSort("level_after")} className="uppercase">New Lv{sortIcon("level_after")}</button>) as unknown as string,
            render: (r) => (
              <span>
                {r.level_after}
                {r.levels_gained > 0 && <span className="ml-1 text-[10px] text-primary">+{r.levels_gained}</span>}
              </span>
            ),
          },
          { key: "status", label: "Status", render: (r) => <span className={STATUS_CLASS[r.status]}>{r.status}</span> },
          {
            key: "actions",
            label: "",
            render: (r) => (
              <button
                onClick={() => replay.mutate(r.id)}
                disabled={replay.isPending || r.status === "failed"}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] uppercase tracking-wider disabled:opacity-40"
                title="Replay this event (admin)"
              >
                <RefreshCw className="h-3 w-3" /> Replay
              </button>
            ),
          },
        ]}
      />

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {filtered.length} events · page {page + 1} / {pages}
        </span>
        <div className="flex gap-1">
          <button
            className="rounded-md border border-border bg-surface-2 p-1 disabled:opacity-40"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            className="rounded-md border border-border bg-surface-2 p-1 disabled:opacity-40"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
