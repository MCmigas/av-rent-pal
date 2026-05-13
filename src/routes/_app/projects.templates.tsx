import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { SECTIONS, sectionLabel, EVENT_TYPES, DEFAULT_INCLUDED, DEFAULT_EXCLUDED } from "@/lib/sections";

export const Route = createFileRoute("/_app/projects/templates")({
  head: () => ({ meta: [{ title: "Templates de orçamento — Eurosom" }] }),
  component: TemplatesPage,
});

type Tmpl = { id: string; name: string; description: string|null; event_type: string|null; default_included: string[]; default_excluded: string[]; organization_id: string };
type TItem = { id: string; template_id: string; kind: "equipment"|"crew"; equipment_id: string|null; crew_role: string|null; quantity: number; section: string; daily_rate: number; cost_rate: number };
type Equip = { id: string; name: string; daily_rate: number; internal_cost_per_day: number };

function TemplatesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Tmpl>>({ default_included: DEFAULT_INCLUDED, default_excluded: DEFAULT_EXCLUDED });
  const [activeId, setActiveId] = useState<string|null>(null);
  const [applyOpen, setApplyOpen] = useState<string|null>(null);

  const { data: tmpls = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_templates").select("*").order("name");
      if (error) throw error; return data as Tmpl[];
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ["template-items", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("project_template_items").select("*").eq("template_id", activeId!);
      if (error) throw error; return data as TItem[];
    },
  });
  const { data: equipList = [] } = useQuery({
    queryKey: ["equipment-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("id,name,daily_rate,internal_cost_per_day").order("name");
      if (error) throw error; return data as Equip[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<Tmpl>) => {
      const { data: orgs } = await supabase.from("organizations").select("id").limit(1);
      const payload: any = { ...p };
      if (!payload.organization_id && orgs?.[0]) payload.organization_id = orgs[0].id;
      if (p.id) {
        const { error } = await supabase.from("project_templates").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("project_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); setOpen(false); toast.success("Guardado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("project_templates").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); if (activeId) setActiveId(null); toast.success("Eliminado"); },
  });
  const addItem = useMutation({
    mutationFn: async (kind: "equipment"|"crew") => {
      const payload: any = { template_id: activeId, kind, quantity: 1, section: kind === "crew" ? "crew" : "other", daily_rate: 0, cost_rate: 0 };
      const { error } = await supabase.from("project_template_items").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template-items", activeId] }),
  });
  const updateItem = useMutation({
    mutationFn: async (row: Partial<TItem> & { id: string }) => {
      const { id, ...p } = row;
      const { error } = await supabase.from("project_template_items").update(p).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template-items", activeId] }),
  });
  const delItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("project_template_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["template-items", activeId] }),
  });

  return (
    <>
      <PageHeader title="Templates de orçamento" subtitle="Configurações reutilizáveis por tipo de evento">
        <Button asChild variant="ghost"><Link to="/projects"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit({ default_included: DEFAULT_INCLUDED, default_excluded: DEFAULT_EXCLUDED }); }}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo template</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit.id ? "Editar" : "Novo"} template</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-2"><Label>Nome</Label>
                <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ex.: Casamento até 80 pax" /></div>
              <div className="grid gap-2"><Label>Tipo de evento</Label>
                <Select value={edit.event_type ?? ""} onValueChange={(v) => setEdit({ ...edit, event_type: v })}>
                  <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid gap-2"><Label>Descrição</Label>
                <Textarea rows={3} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate(edit)} disabled={!edit.name}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-[320px,1fr]">
        <Card><CardHeader><CardTitle className="text-base">Templates</CardTitle></CardHeader>
          <CardContent className="p-0">
            {tmpls.length === 0 && <p className="p-4 text-sm text-muted-foreground">Sem templates. Cria o teu primeiro.</p>}
            {tmpls.map((t) => (
              <button key={t.id} onClick={() => setActiveId(t.id)}
                className={`flex w-full flex-col items-start border-b border-border px-4 py-3 text-left hover:bg-muted ${activeId === t.id ? "bg-muted" : ""}`}>
                <span className="font-medium text-sm">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.event_type ?? "—"}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          {!activeId && <CardContent className="p-10 text-center text-muted-foreground">Seleciona um template à esquerda</CardContent>}
          {activeId && <ActiveTemplate
            tmpl={tmpls.find((t) => t.id === activeId)!}
            items={items}
            equipList={equipList}
            onAdd={(k: "equipment"|"crew") => addItem.mutate(k)}
            onUpdate={(r: Partial<TItem> & { id: string }) => updateItem.mutate(r)}
            onDelItem={(id: string) => delItem.mutate(id)}
            onEdit={(t: Partial<Tmpl>) => { setEdit(t); setOpen(true); }}
            onDelete={() => confirm("Eliminar template?") && del.mutate(activeId)}
            onApply={() => setApplyOpen(activeId)}
          />}
        </Card>
      </div>

      <ApplyDialog templateId={applyOpen} onClose={() => setApplyOpen(null)} />
    </>
  );
}

function ActiveTemplate({ tmpl, items, equipList, onAdd, onUpdate, onDelItem, onEdit, onDelete, onApply }: any) {
  return <>
    <CardHeader className="flex-row items-center justify-between">
      <div><CardTitle>{tmpl.name}</CardTitle>
        {tmpl.description && <p className="text-sm text-muted-foreground mt-1">{tmpl.description}</p>}</div>
      <div className="flex gap-2">
        <Button onClick={onApply}><Wand2 className="mr-2 h-4 w-4" />Aplicar a novo projeto</Button>
        <Button variant="outline" onClick={() => onEdit(tmpl)}>Editar</Button>
        <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onAdd("equipment")}><Plus className="mr-1 h-3 w-3" />Equipamento</Button>
        <Button size="sm" variant="outline" onClick={() => onAdd("crew")}><Plus className="mr-1 h-3 w-3" />Função (crew)</Button>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>Tipo</TableHead><TableHead>Item</TableHead><TableHead>Secção</TableHead>
          <TableHead className="w-20">Qtd</TableHead><TableHead className="w-28">€/dia</TableHead><TableHead className="w-28">Custo/dia</TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {items.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground text-center py-6">Sem itens</TableCell></TableRow>}
          {items.map((r: TItem) => (
            <TableRow key={r.id}>
              <TableCell>{r.kind === "equipment" ? "Equip." : "Crew"}</TableCell>
              <TableCell>
                {r.kind === "equipment"
                  ? <Select value={r.equipment_id ?? ""} onValueChange={(v) => {
                      const e = equipList.find((x: Equip) => x.id === v);
                      onUpdate({ id: r.id, equipment_id: v, daily_rate: e?.daily_rate ?? r.daily_rate, cost_rate: e?.internal_cost_per_day ?? r.cost_rate });
                    }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>{equipList.map((e: Equip) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                  : <Input className="h-8" defaultValue={r.crew_role ?? ""} placeholder="ex.: Técnico som" onBlur={(e) => onUpdate({ id: r.id, crew_role: e.target.value })} />}
              </TableCell>
              <TableCell>
                <Select value={r.section} onValueChange={(v) => onUpdate({ id: r.id, section: v })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{SECTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </TableCell>
              <TableCell><Input type="number" className="h-8" defaultValue={r.quantity} onBlur={(e) => onUpdate({ id: r.id, quantity: +e.target.value })} /></TableCell>
              <TableCell><Input type="number" step="0.01" className="h-8" defaultValue={r.daily_rate} onBlur={(e) => onUpdate({ id: r.id, daily_rate: +e.target.value })} /></TableCell>
              <TableCell><Input type="number" step="0.01" className="h-8" defaultValue={r.cost_rate} onBlur={(e) => onUpdate({ id: r.id, cost_rate: +e.target.value })} /></TableCell>
              <TableCell><Button variant="ghost" size="icon" onClick={() => onDelItem(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">Custo estimado por dia: {fmtMoney(items.reduce((s: number, r: TItem) => s + r.quantity * r.cost_rate, 0))} · Receita: {fmtMoney(items.reduce((s: number, r: TItem) => s + r.quantity * r.daily_rate, 0))}</p>
      <p className="text-xs text-muted-foreground">Secções incluídas: {Array.from(new Set(items.map((r: TItem) => sectionLabel(r.section)))).join(", ") || "—"}</p>
    </CardContent>
  </>;
}

function ApplyDialog({ templateId, onClose }: { templateId: string|null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const apply = useMutation({
    mutationFn: async () => {
      if (!templateId) return;
      const { data: tmpl, error: tErr } = await supabase.from("project_templates").select("*").eq("id", templateId).single();
      if (tErr) throw tErr;
      const { data: tItems, error: iErr } = await supabase.from("project_template_items").select("*").eq("template_id", templateId);
      if (iErr) throw iErr;
      const { data: created, error: pErr } = await supabase.from("projects").insert({
        title: title || tmpl.name, client_name: client || null,
        start_date: start || null, end_date: end || null,
        status: "quote", organization_id: tmpl.organization_id,
        included_items: tmpl.default_included ?? [],
        excluded_items: tmpl.default_excluded ?? [],
        event_type: tmpl.event_type,
      }).select("id").single();
      if (pErr) throw pErr;

      for (const it of tItems ?? []) {
        if (it.kind === "equipment" && it.equipment_id) {
          await supabase.from("project_equipment").insert({
            project_id: created.id, equipment_id: it.equipment_id,
            quantity: it.quantity, rate: it.daily_rate, cost_rate: it.cost_rate,
            section: it.section,
          });
        }
      }
      return created.id as string;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado a partir do template");
      onClose();
      if (newId) window.location.assign(`/projects/${newId}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return <Dialog open={!!templateId} onOpenChange={(o) => !o && onClose()}>
    <DialogContent>
      <DialogHeader><DialogTitle>Aplicar template a novo projeto</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-2"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="(usa o nome do template se vazio)" /></div>
        <div className="grid gap-2"><Label>Cliente</Label><Input value={client} onChange={(e) => setClient(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2"><Label>Início</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Fim</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Os itens de equipamento, secções e listas Inclui/Não inclui do template serão copiados para o novo projeto. Ajusta depois conforme necessário.</p>
      </div>
      <DialogFooter><Button onClick={() => apply.mutate()} disabled={apply.isPending}>Criar projeto</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}