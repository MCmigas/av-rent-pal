import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { Maintenance } from "./types";

const empty = { type: "service", performed_at: new Date().toISOString().slice(0, 10), cost: 0, description: "", next_due: "" };

export function MaintenanceList({ equipmentId, organizationId }: { equipmentId: string; organizationId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(empty);
  const [adding, setAdding] = useState(false);

  const { data = [] } = useQuery({
    queryKey: ["maintenance", equipmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment_maintenance")
        .select("*").eq("equipment_id", equipmentId).order("performed_at", { ascending: false });
      if (error) throw error;
      return data as Maintenance[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form, equipment_id: equipmentId, organization_id: organizationId };
      if (!payload.next_due) delete payload.next_due;
      const { error } = await supabase.from("equipment_maintenance").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance", equipmentId] });
      setForm(empty); setAdding(false); toast.success("Registo adicionado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment_maintenance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance", equipmentId] }),
  });

  return (
    <div className="space-y-4">
      {!adding && (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo registo
        </Button>
      )}
      {adding && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Revisão</SelectItem>
                  <SelectItem value="repair">Reparação</SelectItem>
                  <SelectItem value="calibration">Calibração</SelectItem>
                  <SelectItem value="inspection">Inspeção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Data</Label>
              <Input type="date" value={form.performed_at} onChange={(e) => setForm({ ...form, performed_at: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>Próxima revisão</Label>
              <Input type="date" value={form.next_due} onChange={(e) => setForm({ ...form, next_due: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Custo €</Label>
              <Input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: +e.target.value })} /></div>
          </div>
          <div className="grid gap-2"><Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setForm(empty); }}>Cancelar</Button>
            <Button size="sm" onClick={() => add.mutate()} disabled={add.isPending}>Adicionar</Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {data.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem registos de manutenção.</p>}
        {data.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{m.type}</Badge>
                <span className="text-sm font-medium">{fmtDate(m.performed_at)}</span>
                {m.cost > 0 && <span className="text-sm text-muted-foreground">· {fmtMoney(Number(m.cost))}</span>}
                {m.next_due && <span className="text-xs text-muted-foreground">· próx: {fmtDate(m.next_due)}</span>}
              </div>
              {m.description && <p className="text-sm text-muted-foreground mt-1">{m.description}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => del.mutate(m.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}