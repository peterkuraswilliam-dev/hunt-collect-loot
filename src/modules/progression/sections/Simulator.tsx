import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Minus, Plus, TrendingUp } from "lucide-react";
import {
  awardXp,
  demoSubjectsQuery,
  progressionLevelsQuery,
  progressionTypesQuery,
  subjectProgressionQuery,
  xpAwardLogQuery,
  xpSourcesQuery,
} from "../queries";

export function Simulator() {
  const qc = useQueryClient();
  const { data: subjects = [] } = useQuery(demoSubjectsQuery);
  const { data: types = [] } = useQuery(progressionTypesQuery);
  const { data: sources = [] } = useQuery(xpSourcesQuery);
  const { data: levels = [] } = useQuery(progressionLevelsQuery);

  const [subjectId, setSubjectId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [sourceId, setSourceId] = useState<string>("");
  const [amount, setAmount] = useState<number>(100);
  const [message, setMessage] = useState<string>("");

  const { data: progressions = [] } = useQuery(subjectProgressionQuery(subjectId || null));
  const { data: log = [] } = useQuery(xpAwardLogQuery(subjectId || null, typeId || null));

  const currentProg = progressions.find((p) => p.progression_type_id === typeId);
  const currentType = types.find((t) => t.id === typeId);
  const typeLevels = useMemo(
    () => levels.filter((l) => l.progression_type_id === typeId).sort((a, b) => a.level_number - b.level_number),
    [levels, typeId],
  );
  const filteredSources = useMemo(
    () => sources.filter((s) => !typeId || s.progression_type_id === typeId || !s.progression_type_id),
    [sources, typeId],
  );

  const currentXp = currentProg?.current_xp ?? currentType?.starting_xp ?? 0;
  const currentLevel = currentProg?.current_level ?? currentType?.starting_level ?? 1;
  const nextLevelRow = typeLevels.find((l) => l.level_number === currentLevel + 1);
  const nextLevelXp = nextLevelRow?.xp_required ?? null;
  const xpToNext = nextLevelXp !== null ? Math.max(nextLevelXp - currentXp, 0) : null;

  const mutation = useMutation({
    mutationFn: (delta: number) =>
      awardXp({
        subjectId,
        progressionTypeId: typeId,
        xpSourceId: sourceId || null,
        amount: delta,
      }),
    onSuccess: (res) => {
      setMessage(
        res.leveled_up
          ? `+${res.levels_gained} level(s)! Now L${res.level_after} @ ${res.xp_after} XP`
          : `XP: ${res.xp_before} → ${res.xp_after} (L${res.level_after})`,
      );
      qc.invalidateQueries({ queryKey: ["subject_progression", subjectId] });
      qc.invalidateQueries({ queryKey: ["xp_award_log", subjectId, typeId] });
    },
    onError: (e: Error) => setMessage(`Error: ${e.message}`),
  });

  const canRun = subjectId && typeId && amount > 0 && !mutation.isPending;

  return (
    <div className="space-y-3">
      <div className="panel-gold flex items-center gap-2 p-3">
        <FlaskConical className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wider">XP Engine Tester</h2>
          <p className="text-[10px] text-muted-foreground">
            Validate award / remove / level calculations against configured CMS data.
          </p>
        </div>
      </div>

      <div className="panel space-y-3 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Demo player</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
            >
              <option value="">— Select —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Progression type</span>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
            >
              <option value="">— Select —</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">XP source (optional)</span>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
            >
              <option value="">— Manual —</option>
              {filteredSources.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.base_xp} XP)</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Amount</span>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            disabled={!canRun}
            onClick={() => mutation.mutate(amount)}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Award XP
          </button>
          <button
            disabled={!canRun}
            onClick={() => mutation.mutate(-amount)}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5" /> Remove XP
          </button>
        </div>
        {message && <div className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px]">{message}</div>}
      </div>

      {subjectId && typeId && (
        <div className="panel space-y-2 p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Current progression</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-surface-2 p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Level</div>
              <div className="font-display text-xl font-extrabold">{currentLevel}</div>
            </div>
            <div className="rounded-md bg-surface-2 p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Current XP</div>
              <div className="font-display text-xl font-extrabold">{currentXp.toLocaleString()}</div>
            </div>
            <div className="rounded-md bg-surface-2 p-2">
              <div className="text-[10px] uppercase text-muted-foreground">To next lvl</div>
              <div className="font-display text-xl font-extrabold">
                {xpToNext === null ? "MAX" : xpToNext.toLocaleString()}
              </div>
            </div>
          </div>
          {nextLevelXp !== null && (
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, Math.max(0, ((currentXp - (typeLevels.find((l) => l.level_number === currentLevel)?.xp_required ?? 0)) / Math.max(1, nextLevelXp - (typeLevels.find((l) => l.level_number === currentLevel)?.xp_required ?? 0))) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {log.length > 0 && (
        <div className="panel p-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Recent XP events</div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th>When</th><th>Δ</th><th>XP</th><th>Lv</th>
              </tr>
            </thead>
            <tbody>
              {log.map((e) => (
                <tr key={e.id} className="border-t border-border/40">
                  <td className="py-1">{new Date(e.created_at).toLocaleTimeString()}</td>
                  <td className={e.amount >= 0 ? "text-primary" : "text-destructive"}>{e.amount > 0 ? `+${e.amount}` : e.amount}</td>
                  <td>{e.xp_before} → {e.xp_after}</td>
                  <td>{e.level_before}{e.leveled_up ? ` → ${e.level_after} ⬆` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
