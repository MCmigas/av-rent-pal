import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fmtMoney, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_app/invoices")({
  head: () => ({ meta: [{ title: "Faturas — Eurosom" }] }),
  component: InvoicesPage,
});

type I = { id: string; invoice_number: string; project_id: string|null; amount: number; status: string; issue_date: string; due_date: string|null; notes: string|null };

const empty: Partial<I> = { status: "draft", amount: 0, issue_date: new Date().toISOString().slice(0,10) };

function InvoicesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<I>>(empty);

  const projects = useQuery({ queryKey: ["projects-min"], queryFn: async () => {
    const { data, error } = await supabase.from("projects").select("id, title");
    if (error) throw error; return data;
  }});
  const list = useQuery({ queryKey: ["invoices"], queryFn: async () => {
    const { data, error } = await supabase.from("invoices").select("*").order("issue_date", { ascending: false });
    if (error) throw error; return data as I[];
  }});

  const save = useMutation({
    mutationFn: async (i: Partial<I>) => {
      const payload: any = { ...i };
      if (!payload.invoice_number) payload.invoice_number = `INV-${Date.now()}`;
      if (payload.due_date === "") payload.due_date = null;
      if (payload.project_id === "") payload.project_id = null;
      if (i.id) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", i.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoices").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); setOpen(false); toast.success("Guardado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("invoices").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Eliminado"); },
  });

  const projTitle = (id: string|null) => id ? projects.data?.find((p) => p.id === id)?.title ?? "—" : "—";

  return (
    <>
      <PageHeader title="Faturas" subtitle="Faturação e pagamentos">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(empty); }}>
          <DialogTrigger asChild><Button onClick={() => setEdit(empty)}><Plus className="mr-2 h-4 w-4" />Nova fatura</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit.id ? "Editar" : "Nova"} fatura</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Número</Label>
                  <Input placeholder="auto" value={edit.invoice_number ?? ""} onChange={(e) => setEdit({ ...edit, invoice_number: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Estado</Label>
                  <Select value={edit.status ?? "draft"} onValueChange={(v) => setEdit({ ...edit, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Rascunho</SelectItem>
                      <SelectItem value="sent">Enviada</SelectItem>
                      <SelectItem value="paid">Paga</SelectItem>
                      <SelectItem value="overdue">Em atraso</SelectItem>
                    </SelectContent>
                  </Select></div>
              </div>
              <div className="grid gap-2"><Label>Projeto</Label>
                <Select value={edit.project_id ?? ""} onValueChange={(v) => setEdit({ ...edit, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sem projeto" /></SelectTrigger>
                  <SelectContent>{projects.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>Emissão</Label>
                  <Input type="date" value={edit.issue_date ?? ""} onChange={(e) => setEdit({ ...edit, issue_date: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Vencimento</Label>
                  <Input type="date" value={edit.due_date ?? ""} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Valor €</Label>
                  <Input type="number" step="0.01" value={edit.amount ?? 0} onChange={(e) => setEdit({ ...edit, amount: +e.target.value })} /></div>
              </div>
              <div className="grid gap-2"><Label>Notas</Label>
                <Textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate(edit)}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nº</TableHead><TableHead>Projeto</TableHead><TableHead>Emissão</TableHead>
            <TableHead>Vencimento</TableHead><TableHead>Valor</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(list.data ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem faturas.</TableCell></TableRow>}
            {list.data?.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.invoice_number}</TableCell>
                <TableCell>{projTitle(i.project_id)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(i.issue_date)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(i.due_date)}</TableCell>
                <TableCell>{fmtMoney(Number(i.amount))}</TableCell>
                <TableCell><Badge variant={i.status === "paid" ? "default" : i.status === "overdue" ? "destructive" : "outline"}>{i.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEdit(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => confirm("Eliminar?") && del.mutate(i.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
