import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminTable, Field, inputCls } from "@/components/admin/AdminTable";
import { currenciesQuery, type Currency } from "../queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export function Currencies() {
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery(currenciesQuery);
  const [draft, setDraft] = useState<Partial<Currency>>({ slug: "", name: "", symbol: "" });

  const create = useMutation({
    mutationFn: async () => {
      if (!draft.slug || !draft.name) throw new Error("Slug and name required");
      const { error } = await sb.from("currencies").insert({
        slug: draft.slug, name: draft.name, symbol: draft.symbol ?? null,
        description: draft.description ?? null, sort_order: rows.length,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["currencies"] }); setDraft({ slug: "", name: "", symbol: "" }); },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Currency> }) => {
      const { error } = await sb.from("currencies").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["currencies"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("currencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["currencies"] }),
  });

  return (
    <div className="space-y-3">
      <section className="panel space-y-2 p-3">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-primary">Add currency</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Slug"><input className={inputCls} value={draft.slug ?? ""} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} /></Field>
          <Field label="Name"><input className={inputCls} value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Symbol"><input className={inputCls} value={draft.symbol ?? ""} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} /></Field>
          <Field label="Description"><input className={inputCls} value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end">
          <button disabled={create.isPending} onClick={() => create.mutate()} className="btn-gold inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        {create.error && <p className="text-xs text-destructive">{(create.error as Error).message}</p>}
      </section>

      <AdminTable
        rows={rows}
        empty="No currencies."
        columns={[
          { key: "name", label: "Currency", render: (r) => (
            <div>
              <div className="font-semibold">{r.symbol ? `${r.symbol} ` : ""}{r.name}</div>
              <div className="text-[10px] text-muted-foreground">{r.slug}{r.is_system ? " · system" : ""}</div>
            </div>
          ) },
          { key: "enabled", label: "Enabled", render: (r) => (
            <input type="checkbox" checked={r.enabled} className="h-4 w-4 accent-primary"
              onChange={(e) => update.mutate({ id: r.id, patch: { enabled: e.target.checked } })} />
          ) },
          { key: "sort", label: "Sort", render: (r) => (
            <input type="number" defaultValue={r.sort_order} className={`${inputCls} h-8 w-16 px-2 py-1 text-xs`}
              onBlur={(e) => update.mutate({ id: r.id, patch: { sort_order: Number(e.target.value) } })} />
          ) },
          { key: "name_edit", label: "Rename", render: (r) => (
            <input defaultValue={r.name} className={`${inputCls} h-8 px-2 py-1 text-xs`}
              onBlur={(e) => e.target.value !== r.name && update.mutate({ id: r.id, patch: { name: e.target.value } })} />
          ) },
          { key: "actions", label: "", render: (r) => (
            <button disabled={r.is_system} onClick={() => del.mutate(r.id)}
              className="rounded border border-border bg-surface-2 p-1.5 text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-40">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) },
        ]}
      />
      <p className="text-[10px] text-muted-foreground"><Save className="mr-1 inline h-3 w-3" />Edits save on blur. System currencies cannot be deleted.</p>
    </div>
  );
}
