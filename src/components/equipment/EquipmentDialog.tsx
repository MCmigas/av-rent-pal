import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Upload, Loader2, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { MaintenanceList } from "./MaintenanceList";
import type { Equipment } from "./types";

export function EquipmentDialog({ open, onOpenChange, item }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  item: Partial<Equipment> | null;
}) {
  const qc = useQueryClient();
  const { organizationId, activeLocationId } = usePermissions();
  const [form, setForm] = useState<Partial<Equipment>>({});
  const [uploading, setUploading] = useState<"image" | "manual" | null>(null);
  const fileImgRef = useRef<HTMLInputElement>(null);
  const fileManRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(item?.id ? item : {
        category: "audio", quantity: 1, daily_rate: 0, status: "available",
        condition: "good", location_id: activeLocationId ?? null,
        ...item,
      });
    }
  }, [open, item, activeLocationId]);

  const save = useMutation({
    mutationFn: async (data: Partial<Equipment>) => {
      const payload: any = { ...data };
      delete payload.id;
      if (!organizationId) throw new Error("Organização não selecionada");
      payload.organization_id = organizationId;
      if (form.id) {
        const { error } = await supabase.from("equipment").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipment").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment"] });
      onOpenChange(false);
      toast.success("Guardado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const upload = async (file: File, kind: "image" | "manual") => {
    if (!organizationId) return;
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop();
      const path = `${organizationId}/${kind}s/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("equipment").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("equipment").getPublicUrl(path);
      setForm((f) => ({ ...f, [kind === "image" ? "image_url" : "manual_url"]: data.publicUrl }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(null);
    }
  };

  const qrValue = form.id ? `${window.location.origin}/equipment/${form.id}` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="media">Foto & Manual</TabsTrigger>
            <TabsTrigger value="maintenance" disabled={!form.id}>Manutenção</TabsTrigger>
            <TabsTrigger value="qr" disabled={!form.id}>QR Code</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={form.category ?? "audio"} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="audio">Som</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="lighting">Iluminação</SelectItem>
                    <SelectItem value="staging">Estrutura</SelectItem>
                    <SelectItem value="cabling">Cabos</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Estado</Label>
                <Select value={form.status ?? "available"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponível</SelectItem>
                    <SelectItem value="rented">Alugado</SelectItem>
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                    <SelectItem value="retired">Reformado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Marca</Label>
                <Input value={form.brand ?? ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Modelo</Label>
                <Input value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Nº série</Label>
                <Input value={form.serial_number ?? ""} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Quantidade</Label>
                <Input type="number" value={form.quantity ?? 1} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} /></div>
              <div className="grid gap-2"><Label>Diária €</Label>
                <Input type="number" step="0.01" value={form.daily_rate ?? 0} onChange={(e) => setForm({ ...form, daily_rate: +e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Conservação</Label>
                <Select value={form.condition ?? "good"} onValueChange={(v) => setForm({ ...form, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Novo</SelectItem>
                    <SelectItem value="good">Bom</SelectItem>
                    <SelectItem value="fair">Razoável</SelectItem>
                    <SelectItem value="poor">Mau</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Compra</Label>
                <Input type="date" value={form.purchase_date ?? ""} onChange={(e) => setForm({ ...form, purchase_date: e.target.value || null })} /></div>
              <div className="grid gap-2"><Label>Preço compra €</Label>
                <Input type="number" step="0.01" value={form.purchase_price ?? ""} onChange={(e) => setForm({ ...form, purchase_price: e.target.value ? +e.target.value : null })} /></div>
            </div>
            <div className="grid gap-2"><Label>Notas</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </TabsContent>

          <TabsContent value="media" className="space-y-4">
            <div>
              <Label>Foto</Label>
              <div className="mt-2 flex items-start gap-4">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="" className="h-32 w-32 rounded-lg object-cover border" />
                    <button onClick={() => setForm({ ...form, image_url: null })}
                      className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-1">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-32 w-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">Sem foto</div>
                )}
                <div>
                  <input ref={fileImgRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "image")} />
                  <Button variant="outline" onClick={() => fileImgRef.current?.click()} disabled={uploading === "image"}>
                    {uploading === "image" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Carregar foto
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <Label>Manual / ficha técnica</Label>
              <div className="mt-2 flex items-center gap-4">
                {form.manual_url && (
                  <a href={form.manual_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <FileText className="h-4 w-4" /> Ver ficheiro
                  </a>
                )}
                <input ref={fileManRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "manual")} />
                <Button variant="outline" onClick={() => fileManRef.current?.click()} disabled={uploading === "manual"}>
                  {uploading === "manual" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Carregar manual
                </Button>
                {form.manual_url && (
                  <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, manual_url: null })}>Remover</Button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="maintenance">
            {form.id && <MaintenanceList equipmentId={form.id} organizationId={organizationId!} />}
          </TabsContent>

          <TabsContent value="qr" className="flex flex-col items-center gap-4 py-4">
            {qrValue && (
              <>
                <div className="rounded-lg bg-white p-4">
                  <QRCodeSVG value={qrValue} size={200} />
                </div>
                <p className="text-sm text-muted-foreground text-center">{form.name}<br />{qrValue}</p>
                <Button variant="outline" onClick={() => window.print()}>Imprimir</Button>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.name}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}