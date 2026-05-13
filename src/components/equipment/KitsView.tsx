import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package, X } from "lucide-react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import type { Kit, KitItem, Equipment } from "./types";

type KitWithItems = Kit & { items: (KitItem & { equipmentName?: string })[] };

export function KitsView() {
  const qc = useQueryClient();
  const { organizationId, can } = usePermissions();
  const canManage = can("equipment.manage");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Kit> & { items?: { equipment_id: string; quantity: number; id?: string }[] }>({});

  const { data: kits = [] } = useQuery({
    queryKey: ["kits"],
    queryFn: async () => {
      const [{ data: ks, error: e1 }, { data: its, error: e2 }, { data: eq, error: e3 }] = await Promise.all([
        supabase.from("equipment_kits").select("*").order("name"),
        supabase.from("kit_items").select("*"),
        supabase.from("equipment").select("id, name"),
      ]);
      if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;
      const eqMap = new Map((eq ?? []).map((e: any) => [e.id, e.name]));
      return (ks ?? []).map((k: any) => ({
        ...k,
        items: (its ?? []).filter((i: any) => i.kit_id === k.id)
          .map((i: any) => ({ ...i, equipmentName: eqMap.get(i.equipment_id) })),
      })) as KitWithItems[];
    },
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("id, name, category").order("name");
      if (error) throw error;
      return data as Pick<Equipment, "id" | "name" | "category">[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("Sem organização");
      const { items, ...kit } = editing;
      let kitId = kit.id;
      if (kitId) {
        const { error } = await supabase.from("equipment_kits").update({
          name: kit.name, description: kit.description, daily_rate: kit.daily_rate ?? 0, active: kit.active ?? true,
        }).eq("id", kitId);
        if (error) throw error;
        await supabase.from("kit_items").delete().eq("kit_id", kitId);
      } else {
        const { data, error } = await supabase.from("equipment_kits").insert({
          organization_id: organizationId, name: kit.name!, description: kit.description ?? null,
          daily_rate: kit.daily_rate ?? 0, active: true,
        }).select("id").single();
        if (error) throw error;
        kitId = data.id;
      }
      if (items?.length) {
        const { error } = await supabase.from("kit_items").insert(
          items.map((i) => ({ kit_id: kitId, equipment_id: i.equipment_id, quantity: i.quantity }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kits"] }); setOpen(false); toast.success("Guardado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment_kits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kits"] }); toast.success("Eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing({ name: "", daily_rate: 0, items: [] }); setOpen(true); };
  const openEdit = (k: KitWithItems) => {
    setEditing({ ...k, items: k.items.map((i) => ({ equipment_id: i.equipment_id, quantity: i.quantity })) });
    setOpen(true);
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        {canManage && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo kit</Button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kits.length === 0 && <div className="col-span-full text-center text-muted-foreground py-12">Sem kits criados.</div>}
        {kits.map((k) => (
          <div key={k.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">{k.name}</h3>
              </div>
              <span className="text-sm font-medium">{fmtMoney(Number(k.daily_rate))}/dia</span>
            </div>
            {k.description && <p className="text-sm text-muted-foreground mb-3">{k.description}</p>}
            <div className="space-y-1 mb-3">
              {k.items.map((i) => (
                <div key={i.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{i.equipmentName ?? "—"}</span>
                  <Badge variant="outline" className="text-xs">×{i.quantity}</Badge>
                </div>
              ))}
              {k.items.length === 0 && <p className="text-xs text-muted-foreground italic">Vazio</p>}
            </div>
            {canManage && (
              <div className="flex justify-end gap-1 border-t border-border pt-2">
                <Button variant="ghost" size="icon" onClick={() => openEdit(k)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => confirm(`Eliminar "${k.name}"?`) && del.mutate(k.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing.id ? "Editar kit" : "Novo kit"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2"><Label>Nome *</Label>
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div className="grid gap-2"><Label>Descrição</Label>
              <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="grid gap-2 max-w-[200px]"><Label>Diária €</Label>
              <Input type="number" step="0.01" value={editing.daily_rate ?? 0}
                onChange={(e) => setEditing({ ...editing, daily_rate: +e.target.value })} /></div>
            <div>
              <Label>Equipamento incluído</Label>
              <div className="mt-2 space-y-2">
                {(editing.items ?? []).map((it, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select value={it.equipment_id} onValueChange={(v) => {
                      const items = [...(editing.items ?? [])]; items[idx] = { ...items[idx], equipment_id: v };
                      setEditing({ ...editing, items });
                    }}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Escolher..." /></SelectTrigger>
                      <SelectContent>
                        {equipment.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min={1} value={it.quantity} className="w-20"
                      onChange={(e) => {
                        const items = [...(editing.items ?? [])]; items[idx] = { ...items[idx], quantity: +e.target.value };
                        setEditing({ ...editing, items });
                      }} />
                    <Button variant="ghost" size="icon" onClick={() => {
                      const items = (editing.items ?? []).filter((_, i) => i !== idx);
                      setEditing({ ...editing, items });
                    }}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setEditing({
                  ...editing, items: [...(editing.items ?? []), { equipment_id: equipment[0]?.id ?? "", quantity: 1 }],
                })}>
                  <Plus className="mr-2 h-4 w-4" />Adicionar equipamento
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !editing.name}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}