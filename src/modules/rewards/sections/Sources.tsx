import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rewardSourcesQuery } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Sources() {
  const qc = useQueryClient();
  const { data: sources = [] } = useQuery(rewardSourcesQuery);

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await sb.from("reward_sources").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reward_sources"] }),
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Toggle which surfaces can award rewards.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {sources.map((s) => (
          <label key={s.id} className="panel flex items-center justify-between px-3 py-2">
            <div>
              <div className="font-display text-sm font-bold">{s.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.slug}</div>
            </div>
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => toggle.mutate({ id: s.id, enabled: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
