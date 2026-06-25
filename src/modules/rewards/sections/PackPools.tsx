import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Field, inputCls } from "@/components/admin/AdminTable";
import { tagsQuery } from "@/modules/assets/queries";
import { packsAdminQuery, type PackRow } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

function TagPicker({ value, onChange, tags }: { value: string[]; onChange: (v: string[]) => void; tags: { id: string; name: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => {
        const on = value.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground"}`}
          >
            {t.name}
          </button>
        );
      })}
      {tags.length === 0 && <span className="text-[10px] text-muted-foreground">Create tags in the Assets module first.</span>}
    </div>
  );
}

function PoolEditor({ pack, tags }: { pack: PackRow; tags: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [include, setInclude] = useState<string[]>(pack.include_tags ?? []);
  const [exclude, setExclude] = useState<string[]>(pack.exclude_tags ?? []);
  const [mode, setMode] = useState<"all" | "any">(pack.match_mode ?? "any");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("packs").update({ include_tags: include, exclude_tags: exclude, match_mode: mode }).eq("id", pack.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packs_admin"] }),
  });

  return (
    <div className="panel space-y-3 p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-display text-sm font-bold">{pack.name}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{pack.tier} · pool</div>
        </div>
        <select className={`${inputCls} max-w-[110px]`} value={mode} onChange={(e) => setMode(e.target.value as "all" | "any")}>
          <option value="any">Match ANY</option>
          <option value="all">Match ALL</option>
        </select>
      </div>
      <Field label="Include tags">
        <TagPicker value={include} onChange={setInclude} tags={tags} />
      </Field>
      <Field label="Exclude tags">
        <TagPicker value={exclude} onChange={setExclude} tags={tags} />
      </Field>
      <div className="flex justify-end">
        <button disabled={save.isPending} onClick={() => save.mutate()} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {save.isPending ? "Saving…" : "Save pool"}
        </button>
      </div>
    </div>
  );
}

export function PackPools() {
  const { data: packs = [] } = useQuery(packsAdminQuery);
  const { data: tags = [] } = useQuery(tagsQuery);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Packs draw assets from tag-driven pools. No manual asset assignment.</p>
      {packs.map((p) => <PoolEditor key={p.id} pack={p} tags={tags} />)}
      {!packs.length && <div className="panel p-6 text-center text-sm text-muted-foreground">Create packs first.</div>}
    </div>
  );
}
