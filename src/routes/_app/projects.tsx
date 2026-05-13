import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FileText, Receipt, ExternalLink, LayoutTemplate } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fmtMoney, fmtDate } from "@/lib/format";
import { generateDocPdf } from "@/lib/pdf";

export const Route = createFileRoute("/_app/projects")({
  head: () => ({ meta: [{ title: "Projetos — Eurosom" }] }),
  component: ProjectsPage,
});

type P = { id: string; title: string; client_name: string|null; venue: string|null; start_date: string|null; end_date: string|null; status: string; total_amount: number; notes: string|null };
const empty: Partial<P> = { status: "quote", total_amount: 0 };

function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<P>>(empty);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("start_date", { ascending: false, nullsFirst: false });
      if (error) throw error; return data as P[];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<P>) => {
      const payload: any = { ...p };
      if (payload.start_date === "") payload.start_date = null;
      if (payload.end_date === "") payload.end_date = null;
      if (p.id) {
        const { error } = await supabase.from("projects").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("projects").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setOpen(false); toast.success("Guardado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("projects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const buildItemsForProject = async (projectId: string) => {
    const [{ data: pe }, { data: ca }] = await Promise.all([
      supabase.from("project_equipment")
        .select("quantity, rate, pickup_date, return_date, equipment:equipment_id(name)")
        .eq("project_id", projectId),
      supabase.from("crew_assignments")
        .select("daily_rate, role, start_date, end_date, profiles:user_id(full_name)")
        .eq("project_id", projectId),
    ]);
    const dayDiff = (a?: string|null, b?: string|null) => {
      if (!a || !b) return 1;
      return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
    };
    const items: { description: string; quantity: number; unit_price: number }[] = [];
    (pe ?? []).forEach((r: any) => {
      const d = dayDiff(r.pickup_date, r.return_date);
      items.push({
        description: `${r.equipment?.name ?? "Equipamento"} (${d} dia${d>1?"s":""})`,
        quantity: r.quantity,
        unit_price: Number(r.rate) * d,
      });
    });
    (ca ?? []).forEach((r: any) => {
      const d = dayDiff(r.start_date, r.end_date);
      items.push({
        description: `Crew — ${r.profiles?.full_name ?? r.role} (${r.role}, ${d}d)`,
        quantity: 1,
        unit_price: Number(r.daily_rate) * d,
      });
    });
    return items;
  };

  const generateQuote = async (p: P) => {
    try {
      const items = await buildItemsForProject(p.id);
      if (items.length === 0) {
        items.push({ description: p.title, quantity: 1, unit_price: Number(p.total_amount) });
      }
      const { data: orgs } = await supabase.from("organizations").select("name, address, tax_id, email, phone").limit(1);
      await generateDocPdf({
        kind: "quote",
        number: `ORC-${p.id.slice(0, 8).toUpperCase()}`,
        issue_date: new Date().toISOString(),
        title: p.title, client_name: p.client_name, venue: p.venue,
        start_date: p.start_date, end_date: p.end_date, notes: p.notes,
        items, org: orgs?.[0] ?? {},
      });
      toast.success("Orçamento gerado");
    } catch (e: any) { toast.error(e.message ?? "Erro ao gerar PDF"); }
  };

  const convertToInvoice = useMutation({
    mutationFn: async (p: P) => {
      const { data, error } = await supabase.rpc("convert_project_to_invoice", {
        _project_id: p.id,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Fatura criada — vê em Faturas"); },
    onError: (e: any) => toast.error(e.message),
  });

  const toInput = (d?: string|null) => d ? d.slice(0,10) : "";

  return (
    <>
      <PageHeader title="Projetos" subtitle="Orçamentos, eventos e produções">
        <Button asChild variant="outline"><Link to="/projects/templates"><LayoutTemplate className="mr-2 h-4 w-4" />Templates</Link></Button>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(empty); }}>
          <DialogTrigger asChild><Button onClick={() => setEdit(empty)}><Plus className="mr-2 h-4 w-4" />Novo projeto</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit.id ? "Editar" : "Novo"} projeto</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2"><Label>Título</Label>
                <Input value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Cliente</Label>
                  <Input value={edit.client_name ?? ""} onChange={(e) => setEdit({ ...edit, client_name: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Local</Label>
                  <Input value={edit.venue ?? ""} onChange={(e) => setEdit({ ...edit, venue: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Início</Label>
                  <Input type="date" value={toInput(edit.start_date)} onChange={(e) => setEdit({ ...edit, start_date: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Fim</Label>
                  <Input type="date" value={toInput(edit.end_date)} onChange={(e) => setEdit({ ...edit, end_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Estado</Label>
                  <Select value={edit.status ?? "quote"} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quote">Orçamento</SelectItem>
                      <SelectItem value="confirmed">Confirmado</SelectItem>
                      <SelectItem value="in_progress">Em curso</SelectItem>
                      <SelectItem value="completed">Concluído</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div className="grid gap-2"><Label>Total €</Label>
                  <Input type="number" step="0.01" value={edit.total_amount ?? 0} onChange={(e) => setEdit({ ...edit, total_amount: +e.target.value })} /></div>
              </div>
              <div className="grid gap-2"><Label>Notas</Label>
                <Textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate(edit)} disabled={!edit.title || save.isPending}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Título</TableHead><TableHead>Cliente</TableHead><TableHead>Local</TableHead>
            <TableHead>Datas</TableHead><TableHead>Estado</TableHead><TableHead>Total</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">A carregar...</TableCell></TableRow>}
            {!isLoading && list.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem projetos.</TableCell></TableRow>}
            {list.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.title}</TableCell>
                <TableCell>{p.client_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.venue ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</TableCell>
                <TableCell><Badge variant={p.status === "completed" ? "outline" : "default"}>{p.status}</Badge></TableCell>
                <TableCell>{fmtMoney(Number(p.total_amount))}</TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="icon" title="Abrir detalhe">
                    <Link to="/projects/$id" params={{ id: p.id }}><ExternalLink className="h-4 w-4" /></Link>
                  </Button>
                  <Button variant="ghost" size="icon" title="PDF orçamento" onClick={() => generateQuote(p)}><FileText className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Converter em fatura"
                    onClick={() => confirm(`Converter "${p.title}" em fatura?`) && convertToInvoice.mutate(p)}>
                    <Receipt className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEdit(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => confirm("Eliminar?") && del.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
