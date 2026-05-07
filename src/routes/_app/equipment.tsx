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
import { fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/equipment")({
  head: () => ({ meta: [{ title: "Equipamento — Eurosom" }] }),
  component: EquipmentPage,
});

type Item = {
  id: string; name: string; category: string; brand: string | null; model: string | null;
  serial_number: string | null; daily_rate: number; quantity: number; status: string; notes: string | null;
};

const empty: Partial<Item> = { category: "audio", quantity: 1, daily_rate: 0, status: "available" };

function EquipmentPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Item>>(empty);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").order("created_at", { ascending: false });
      if (error) throw error; return data as Item[];
    },
  });

  const save = useMutation({
    mutationFn: async (item: Partial<Item>) => {
      if (item.id) {
        const { error } = await supabase.from("equipment").update(item).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipment").insert(item as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipment"] }); setOpen(false); toast.success("Guardado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipment"] }); toast.success("Eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Equipamento" subtitle="Inventário de som, vídeo e iluminação">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(empty); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(empty)}><Plus className="mr-2 h-4 w-4" />Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing.id ? "Editar" : "Novo"} equipamento</DialogTitle></DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2"><Label>Nome</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Categoria</Label>
                  <Select value={editing.category ?? "audio"} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="audio">Som</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="lighting">Iluminação</SelectItem>
                      <SelectItem value="staging">Estrutura</SelectItem>
                      <SelectItem value="other">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Estado</Label>
                  <Select value={editing.status ?? "available"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Disponível</SelectItem>
                      <SelectItem value="rented">Alugado</SelectItem>
                      <SelectItem value="maintenance">Manutenção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Marca</Label>
                  <Input value={editing.brand ?? ""} onChange={(e) => setEditing({ ...editing, brand: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Modelo</Label>
                  <Input value={editing.model ?? ""} onChange={(e) => setEditing({ ...editing, model: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2"><Label>Nº série</Label>
                  <Input value={editing.serial_number ?? ""} onChange={(e) => setEditing({ ...editing, serial_number: e.target.value })} /></div>
                <div className="grid gap-2"><Label>Quantidade</Label>
                  <Input type="number" value={editing.quantity ?? 1} onChange={(e) => setEditing({ ...editing, quantity: +e.target.value })} /></div>
                <div className="grid gap-2"><Label>Diária €</Label>
                  <Input type="number" step="0.01" value={editing.daily_rate ?? 0} onChange={(e) => setEditing({ ...editing, daily_rate: +e.target.value })} /></div>
              </div>
              <div className="grid gap-2"><Label>Notas</Label>
                <Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.name}>Guardar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Marca/Modelo</TableHead>
              <TableHead>Qtd</TableHead><TableHead>Diária</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">A carregar...</TableCell></TableRow>}
            {!isLoading && items.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem equipamento. Adiciona o primeiro.</TableCell></TableRow>}
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.name}</TableCell>
                <TableCell><Badge variant="secondary">{i.category}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{[i.brand, i.model].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell>{i.quantity}</TableCell>
                <TableCell>{fmtMoney(Number(i.daily_rate))}</TableCell>
                <TableCell><Badge variant={i.status === "available" ? "default" : "outline"}>{i.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
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
