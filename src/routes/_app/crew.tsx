import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { fmtMoney, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_app/crew")({
  head: () => ({ meta: [{ title: "Equipa — Eurosom" }] }),
  component: CrewPage,
});

type A = { id: string; project_id: string; user_id: string; role: string; daily_rate: number; start_date: string|null; end_date: string|null };

function CrewPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<A>>({ role: "technician", daily_rate: 0 });

  const projects = useQuery({ queryKey: ["projects-min"], queryFn: async () => {
    const { data, error } = await supabase.from("projects").select("id, title").order("start_date", { ascending: false });
    if (error) throw error; return data;
  }});
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name");
    if (error) throw error; return data;
  }});
  const list = useQuery({ queryKey: ["crew"], queryFn: async () => {
    const { data, error } = await supabase.from("crew_assignments").select("*").order("created_at", { ascending: false });
    if (error) throw error; return data as A[];
  }});

  const save = useMutation({
    mutationFn: async (a: Partial<A>) => {
      const payload: any = { ...a };
      if (payload.start_date === "") payload.start_date = null;
      if (payload.end_date === "") payload.end_date = null;
      const { error } = await supabase.from("crew_assignments").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crew"] }); setOpen(false); toast.success("Atribuído"); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crew_assignments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crew"] }); toast.success("Removido"); },
  });

  const projTitle = (id: string) => projects.data?.find((p) => p.id === id)?.title ?? "—";
  const userName = (id: string) => profiles.data?.find((p) => p.id === id)?.full_name ?? "—";

  return (
    <>
      <PageHeader title="Equipa" subtitle="Atribuição de técnicos a projetos">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Atribuir</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova atribuição</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2"><Label>Projeto</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
                  <SelectContent>{projects.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid gap-2"><Label>Técnico</Label>
                <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
                  <SelectContent>{profiles.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0,8)}</SelectItem>)}</SelectContent>
                </Select></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Função</Label>
                  <Input value={form.role ?? ""} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Diária €</Label>
                  <Input type="number" step="0.01" value={form.daily_rate ?? 0} onChange={(e) => setForm({ ...form, daily_rate: +e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Início</Label>
                  <Input type="date" onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Fim</Label>
                  <Input type="date" onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate(form)} disabled={!form.project_id || !form.user_id}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Projeto</TableHead><TableHead>Técnico</TableHead><TableHead>Função</TableHead>
            <TableHead>Datas</TableHead><TableHead>Diária</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(list.data ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem atribuições.</TableCell></TableRow>}
            {list.data?.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{projTitle(a.project_id)}</TableCell>
                <TableCell>{userName(a.user_id)}</TableCell>
                <TableCell>{a.role}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</TableCell>
                <TableCell>{fmtMoney(Number(a.daily_rate))}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => confirm("Remover?") && del.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
