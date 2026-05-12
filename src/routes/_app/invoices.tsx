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
import { Plus, Pencil, Trash2, FileText, ListPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fmtMoney, fmtDate } from "@/lib/format";
import { generateDocPdf } from "@/lib/pdf";

export const Route = createFileRoute("/_app/invoices")({
  head: () => ({ meta: [{ title: "Faturas — Eurosom" }] }),
  component: InvoicesPage,
});

type I = {
  id: string; invoice_number: string; project_id: string|null; amount: number;
  status: string; issue_date: string; due_date: string|null; notes: string|null;
  subtotal: number; vat_amount: number; vat_rate: number; organization_id: string;
};
type Item = { id: string; invoice_id: string; description: string; quantity: number; unit_price: number; vat_rate: number; sort_order: number };

const empty: Partial<I> = { status: "draft", amount: 0, issue_date: new Date().toISOString().slice(0,10) };

function InvoicesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<I>>(empty);
  const [itemsOpen, setItemsOpen] = useState<I | null>(null);

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

  const downloadPdf = async (inv: I) => {
    try {
      const [{ data: items }, { data: orgs }, { data: proj }] = await Promise.all([
        supabase.from("invoice_items").select("*").eq("invoice_id", inv.id).order("sort_order"),
        supabase.from("organizations").select("name, address, tax_id, email, phone").eq("id", inv.organization_id),
        inv.project_id
          ? supabase.from("projects").select("title, venue, start_date, end_date, client_name").eq("id", inv.project_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      await generateDocPdf({
        kind: "invoice",
        number: inv.invoice_number,
        issue_date: inv.issue_date, due_date: inv.due_date,
        title: (proj as any)?.title, venue: (proj as any)?.venue,
        start_date: (proj as any)?.start_date, end_date: (proj as any)?.end_date,
        client_name: (proj as any)?.client_name,
        notes: inv.notes, vat_rate: Number(inv.vat_rate ?? 23),
        items: (items ?? []).map((i: any) => ({
          description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price),
        })),
        org: orgs?.[0] ?? {},
      });
      toast.success("PDF gerado");
    } catch (e: any) { toast.error(e.message ?? "Erro ao gerar PDF"); }
  };

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
                  <Button variant="ghost" size="icon" title="Linhas" onClick={() => setItemsOpen(i)}><ListPlus className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="PDF" onClick={() => downloadPdf(i)}><FileText className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { setEdit(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => confirm("Eliminar?") && del.mutate(i.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InvoiceItemsDialog invoice={itemsOpen} onClose={() => setItemsOpen(null)} />
    </>
  );
}

function InvoiceItemsDialog({ invoice, onClose }: { invoice: I | null; onClose: () => void }) {
  const qc = useQueryClient();
  const open = !!invoice;
  const items = useQuery({
    enabled: open,
    queryKey: ["invoice-items", invoice?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoice!.id).order("sort_order");
      if (error) throw error; return data as Item[];
    },
  });
  const [draft, setDraft] = useState<{ description: string; quantity: number; unit_price: number }>({ description: "", quantity: 1, unit_price: 0 });

  const recalc = async () => {
    const { data } = await supabase.from("invoice_items").select("quantity, unit_price").eq("invoice_id", invoice!.id);
    const subtotal = (data ?? []).reduce((s: number, r: any) => s + Number(r.quantity) * Number(r.unit_price), 0);
    const rate = Number(invoice!.vat_rate ?? 23);
    const vat = +(subtotal * rate / 100).toFixed(2);
    await supabase.from("invoices").update({ subtotal, vat_amount: vat, amount: +(subtotal + vat).toFixed(2) }).eq("id", invoice!.id);
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!draft.description) throw new Error("Descrição obrigatória");
      const { error } = await supabase.from("invoice_items").insert({ ...draft, invoice_id: invoice!.id });
      if (error) throw error;
      await recalc();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoice-items", invoice!.id] }); setDraft({ description: "", quantity: 1, unit_price: 0 }); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeIt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoice_items").delete().eq("id", id);
      if (error) throw error; await recalc();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoice-items", invoice!.id] }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Linhas — {invoice?.invoice_number}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Descrição</TableHead><TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(items.data ?? []).map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.description}</TableCell>
                    <TableCell className="text-right">{Number(it.quantity)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(it.unit_price))}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(it.quantity) * Number(it.unit_price))}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeIt.mutate(it.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(items.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Sem linhas.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="grid grid-cols-[2fr_80px_120px_auto] gap-2 items-end">
            <div className="grid gap-1"><Label>Descrição</Label>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Qtd</Label>
              <Input type="number" min={1} value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: +e.target.value })} /></div>
            <div className="grid gap-1"><Label>Preço</Label>
              <Input type="number" step="0.01" value={draft.unit_price} onChange={(e) => setDraft({ ...draft, unit_price: +e.target.value })} /></div>
            <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
