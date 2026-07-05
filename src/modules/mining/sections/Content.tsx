import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  MINING_CONTENT_DEFAULTS,
  MINING_MODULE_ID,
  miningSettingsQuery,
  saveMiningSettings,
  type MiningSettings,
} from "../settings";

type Bucket = keyof MiningSettings["content"];

const GROUPS: { key: Bucket; label: string; items: readonly { slug: string; label: string }[] }[] = [
  { key: "areas", label: "Mining Areas", items: MINING_CONTENT_DEFAULTS.areas },
  { key: "rocks", label: "Rock Types", items: MINING_CONTENT_DEFAULTS.rocks },
  { key: "pickaxes", label: "Pickaxes", items: MINING_CONTENT_DEFAULTS.pickaxes },
  { key: "loot", label: "Loot Items", items: MINING_CONTENT_DEFAULTS.loot },
  { key: "events", label: "Random Events", items: MINING_CONTENT_DEFAULTS.events },
];

export function MiningContentSection() {
  const qc = useQueryClient();
  const { data } = useQuery(miningSettingsQuery);
  const [draft, setDraft] = useState<MiningSettings | null>(null);
  useEffect(() => { if (data) setDraft(data); }, [data]);

  const save = useMutation({
    mutationFn: async (next: MiningSettings) => saveMiningSettings(next),
    onSuccess: () => {
      toast.success("Content toggles saved");
      qc.invalidateQueries({ queryKey: ["module_settings", MINING_MODULE_ID] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!draft) return <div className="panel p-4 text-xs text-muted-foreground">Loading…</div>;

  const toggle = (bucket: Bucket, slug: string, v: boolean) =>
    setDraft({
      ...draft,
      content: { ...draft.content, [bucket]: { ...draft.content[bucket], [slug]: v } },
    });

  return (
    <div className="space-y-4">
      {GROUPS.map((g) => (
        <section key={g.key} className="panel p-3 space-y-2">
          <h3 className="text-[10px] uppercase tracking-widest text-primary">{g.label}</h3>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {g.items.map((it) => (
              <label
                key={it.slug}
                className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-xs"
              >
                <span>{it.label}</span>
                <Switch
                  checked={draft.content[g.key][it.slug] ?? true}
                  onCheckedChange={(v) => toggle(g.key, it.slug, v)}
                />
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="flex justify-end">
        <button
          onClick={() => save.mutate(draft)}
          disabled={save.isPending}
          className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> {save.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
