import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, ArrowLeft, FileText, Receipt, Save, Paperclip, Upload, Download, X, FileImage } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";
import { generateDocPdf } from "@/lib/pdf";
import { SECTIONS, sectionLabel, EVENT_TYPES, DEFAULT_INCLUDED, DEFAULT_EXCLUDED } from "@/lib/sections";

export const Route = createFileRoute("/_app/projects/$id")({
  head: () => ({ meta: [{ title: "Projeto — Eurosom" }] }),
  component: ProjectDetailPage,
});

type Project = {
  id: string; title: string; client_name: string|null; venue: string|null;
  start_date: string|null; end_date: string|null; status: string;
  total_amount: number; notes: string|null; event_type: string|null;
  tier_silver_amount: number|null; tier_gold_amount: number|null;
  included_items: string[]; excluded_items: string[];
  organization_id: string;
};

type Equip = { id: string; name: string; brand: string|null; model: string|null; daily_rate: number; internal_cost_per_day: number; highlight: string|null };
type PE = { id: string; equipment_id: string; quantity: number; rate: number; cost_rate: number; section: string; pickup_date: string|null; return_date: string|null; equipment?: { name: string; brand: string|null; model: string|null; highlight: string|null } };
type CA = { id: string; user_id: string; role: string; daily_rate: number; cost_rate: number; section: string; start_date: string|null; end_date: string|null; profiles?: { full_name: string|null } };
type Profile = { id: string; full_name: string|null };
type Attachment = { id: string; project_id: string; original_name: string; content_type: string|null; file_size: number|null; storage_path: string; created_at: string; };


const dayDiff = (a?: string|null, b?: string|null, fb = 1) => {
  if (!a || !b) return fb;
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
};
const toInput = (d?: string|null) => d ? d.slice(0,10) : "";

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) throw error; return data as Project;
    },
  });
  const { data: equipList = [] } = useQuery({
    queryKey: ["equipment-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("id,name,brand,model,daily_rate,internal_cost_per_day,highlight").order("name");
      if (error) throw error; return data as Equip[];
    },
  });
  const { data: peItems = [] } = useQuery({
    queryKey: ["pe", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_equipment")
        .select("*, equipment:equipment_id(name,brand,model,highlight)")
        .eq("project_id", id);
      if (error) throw error; return data as PE[];
    },
  });
  const { data: caItems = [] } = useQuery({
    queryKey: ["ca", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crew_assignments")
        .select("*, profiles:user_id(full_name)")
        .eq("project_id", id);
      if (error) throw error; return data as CA[];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,full_name").order("full_name");
      if (error) throw error; return data as Profile[];
    },
  });

  // Attachments
  const [uploading, setUploading] = useState(false);
  const { data: attachments = [] } = useQuery({
    queryKey: ["attachments", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_attachments")
        .select("id,project_id,original_name,content_type,file_size,storage_path,created_at")
        .eq("project_id", id).order("created_at", { ascending: false });
      if (error) throw error; return data as Attachment[];
    },
  });
  const deleteAttachment = useMutation({
    mutationFn: async (att: Attachment) => {
      const { error: storageError } = await supabase.storage.from("project-attachments").remove([att.storage_path]);
      if (storageError) throw storageError;
      const { error } = await supabase.from("project_attachments").delete().eq("id", att.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attachments", id] }),
    onError: (e: any) => toast.error(e.message),
  });
  const handleFileUpload = async (file: File) => {
    if (!project) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const safeName = `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const path = `${project.organization_id}/${id}/${safeName}`;
      const { error: upError } = await supabase.storage.from("project-attachments").upload(path, file, { contentType: file.type });
      if (upError) throw upError;
      const { error: dbError } = await supabase.from("project_attachments").insert({
        project_id: id,
        organization_id: project.organization_id,
        storage_path: path,
        original_name: file.name,
        content_type: file.type,
        file_size: file.size,
      });
      if (dbError) throw dbError;
      qc.invalidateQueries({ queryKey: ["attachments", id] });
      toast.success("Ficheiro carregado");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao carregar");
    } finally {
      setUploading(false);
    }
  };
  const getSignedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from("project-attachments").createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  };


  // local edit state for header
  const [edit, setEdit] = useState<Partial<Project>>({});
  useEffect(() => { if (project) setEdit(project); }, [project]);

  const days = dayDiff(project?.start_date, project?.end_date);

  // Totals
  const peTotal = useMemo(() => peItems.reduce((s, r) => {
    const d = dayDiff(r.pickup_date, r.return_date, days);
    return s + r.quantity * r.rate * d;
  }, 0), [peItems, days]);
  const peCost = useMemo(() => peItems.reduce((s, r) => {
    const d = dayDiff(r.pickup_date, r.return_date, days);
    return s + r.quantity * r.cost_rate * d;
  }, 0), [peItems, days]);
  const caTotal = useMemo(() => caItems.reduce((s, r) => {
    const d = dayDiff(r.start_date, r.end_date, days);
    return s + r.daily_rate * d;
  }, 0), [caItems, days]);
  const caCost = useMemo(() => caItems.reduce((s, r) => {
    const d = dayDiff(r.start_date, r.end_date, days);
    return s + r.cost_rate * d;
  }, 0), [caItems, days]);

  const subtotal = peTotal + caTotal;
  const totalCost = peCost + caCost;
  const margin = subtotal - totalCost;
  const marginPct = subtotal > 0 ? (margin / subtotal) * 100 : 0;

  const saveHeader = useMutation({
    mutationFn: async () => {
      const payload: any = { ...edit };
      delete payload.organization_id;
      delete payload.id;
      if (payload.start_date === "") payload.start_date = null;
      if (payload.end_date === "") payload.end_date = null;
      payload.total_amount = subtotal;
      const { error } = await supabase.from("projects").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", id] }); qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Guardado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addEquip = useMutation({
    mutationFn: async (equipId: string) => {
      const e = equipList.find((x) => x.id === equipId);
      if (!e) return;
      const { error } = await supabase.from("project_equipment").insert({
        project_id: id, equipment_id: equipId, quantity: 1,
        rate: e.daily_rate, cost_rate: e.internal_cost_per_day, section: "other",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pe", id] }),
    onError: (e: any) => toast.error(e.message),
  });
  const updatePE = useMutation({
    mutationFn: async (row: Partial<PE> & { id: string }) => {
      const { id: rid, equipment, ...payload } = row as any;
      if (payload.pickup_date === "") payload.pickup_date = null;
      if (payload.return_date === "") payload.return_date = null;
      const { error } = await supabase.from("project_equipment").update(payload).eq("id", rid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pe", id] }),
    onError: (e: any) => toast.error(e.message),
  });
  const delPE = useMutation({
    mutationFn: async (rid: string) => { const { error } = await supabase.from("project_equipment").delete().eq("id", rid); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pe", id] }),
  });

  const addCrew = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("crew_assignments").insert({
        project_id: id, user_id: userId, role: "technician", daily_rate: 0, cost_rate: 0, section: "crew",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ca", id] }),
    onError: (e: any) => toast.error(e.message),
  });
  const updateCA = useMutation({
    mutationFn: async (row: Partial<CA> & { id: string }) => {
      const { id: rid, profiles: _p, ...payload } = row as any;
      if (payload.start_date === "") payload.start_date = null;
      if (payload.end_date === "") payload.end_date = null;
      const { error } = await supabase.from("crew_assignments").update(payload).eq("id", rid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ca", id] }),
    onError: (e: any) => toast.error(e.message),
  });
  const delCA = useMutation({
    mutationFn: async (rid: string) => { const { error } = await supabase.from("crew_assignments").delete().eq("id", rid); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ca", id] }),
  });

  const generateQuote = async () => {
    if (!project) return;
    try {
      const items: any[] = [];
      peItems.forEach((r) => {
        const d = dayDiff(r.pickup_date, r.return_date, days);
        const name = r.equipment?.name ?? "Equipamento";
        const brand = [r.equipment?.brand, r.equipment?.model].filter(Boolean).join(" ");
        const desc = brand ? `${name} — ${brand}` : name;
        const hl = r.equipment?.highlight ? `\n${r.equipment.highlight}` : "";
        items.push({
          description: `${desc} (${d} dia${d>1?"s":""})${hl}`,
          quantity: r.quantity, unit_price: r.rate * d, section: r.section,
        });
      });
      caItems.forEach((r) => {
        const d = dayDiff(r.start_date, r.end_date, days);
        items.push({
          description: `${r.profiles?.full_name ?? r.role} — ${r.role} (${d}d)`,
          quantity: 1, unit_price: r.daily_rate * d, section: r.section || "crew",
        });
      });
      if (items.length === 0) {
        items.push({ description: project.title, quantity: 1, unit_price: Number(project.total_amount), section: "other" });
      }
      const { data: orgs } = await supabase.from("organizations").select("name, address, tax_id, email, phone").limit(1);
      const tiers: any[] = [];
      const baseAmount = subtotal || Number(project.total_amount);
      tiers.push({ label: "Essencial", amount: baseAmount, description: "Configuração proposta abaixo" });
      if (project.tier_silver_amount) tiers.push({ label: "Plus", amount: Number(project.tier_silver_amount), description: "Reforço de PA + 1 técnico extra" });
      if (project.tier_gold_amount) tiers.push({ label: "Premium", amount: Number(project.tier_gold_amount), description: "Sistema topo de gama, redundância total e equipa alargada" });

      await generateDocPdf({
        kind: "quote",
        number: `ORC-${project.id.slice(0, 8).toUpperCase()}`,
        issue_date: new Date().toISOString(),
        title: project.title, client_name: project.client_name, venue: project.venue,
        start_date: project.start_date, end_date: project.end_date, notes: project.notes,
        items, org: orgs?.[0] ?? {},
        included: project.included_items?.length ? project.included_items : DEFAULT_INCLUDED,
        excluded: project.excluded_items?.length ? project.excluded_items : DEFAULT_EXCLUDED,
        tiers: tiers.length > 1 ? tiers : undefined,
        group_by_section: true,
      });
      toast.success("Orçamento gerado");
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
  };

  const convertToInvoice = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("convert_project_to_invoice", { _project_id: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => { toast.success("Fatura criada — vê em Faturas"); navigate({ to: "/invoices" as any }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !project) return <div className="p-6 text-muted-foreground">A carregar…</div>;

  return (
    <>
      <PageHeader title={project.title} subtitle={project.client_name ?? undefined}>
        <Button asChild variant="ghost"><Link to="/projects"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
        <Button variant="outline" onClick={generateQuote}><FileText className="mr-2 h-4 w-4" />PDF orçamento</Button>
        <Button variant="outline" onClick={() => confirm("Converter em fatura?") && convertToInvoice.mutate()}><Receipt className="mr-2 h-4 w-4" />Faturar</Button>
        <Button onClick={() => saveHeader.mutate()} disabled={saveHeader.isPending}><Save className="mr-2 h-4 w-4" />Guardar</Button>
      </PageHeader>

      <Tabs defaultValue="items" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="items">Itens & Equipa</TabsTrigger>
          <TabsTrigger value="tiers">Opções (Tiers)</TabsTrigger>
          <TabsTrigger value="incl">Inclui / Não inclui</TabsTrigger>
          <TabsTrigger value="margin">Margem (interno)</TabsTrigger>
          <TabsTrigger value="attachments">Anexos</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card><CardContent className="grid gap-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Título</Label>
                <Input value={edit.title ?? ""} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Tipo de evento</Label>
                <Select value={edit.event_type ?? ""} onValueChange={(v) => setEdit({ ...edit, event_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Cliente</Label>
                <Input value={edit.client_name ?? ""} onChange={(e) => setEdit({ ...edit, client_name: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Local</Label>
                <Input value={edit.venue ?? ""} onChange={(e) => setEdit({ ...edit, venue: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Início</Label>
                <Input type="date" value={toInput(edit.start_date)} onChange={(e) => setEdit({ ...edit, start_date: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Fim</Label>
                <Input type="date" value={toInput(edit.end_date)} onChange={(e) => setEdit({ ...edit, end_date: e.target.value })} /></div>
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
            </div>
            <div className="grid gap-2"><Label>Notas (aparecem no PDF)</Label>
              <Textarea rows={4} value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Equipamento</CardTitle>
              <Select onValueChange={(v) => v && addEquip.mutate(v)}>
                <SelectTrigger className="w-72"><SelectValue placeholder="+ Adicionar equipamento" /></SelectTrigger>
                <SelectContent>{equipList.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}{e.brand ? ` — ${e.brand}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Item</TableHead><TableHead>Secção</TableHead>
                  <TableHead className="w-20">Qtd</TableHead><TableHead className="w-28">€/dia</TableHead>
                  <TableHead className="w-28">Custo/dia</TableHead><TableHead className="w-28">Total</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {peItems.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground text-center py-6">Sem equipamento</TableCell></TableRow>}
                  {peItems.map((r) => {
                    const d = dayDiff(r.pickup_date, r.return_date, days);
                    return <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.equipment?.name}</TableCell>
                      <TableCell>
                        <Select value={r.section} onValueChange={(v) => updatePE.mutate({ id: r.id, section: v })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>{SECTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Input type="number" className="h-8" defaultValue={r.quantity} onBlur={(e) => updatePE.mutate({ id: r.id, quantity: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" className="h-8" defaultValue={r.rate} onBlur={(e) => updatePE.mutate({ id: r.id, rate: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" className="h-8" defaultValue={r.cost_rate} onBlur={(e) => updatePE.mutate({ id: r.id, cost_rate: +e.target.value })} /></TableCell>
                      <TableCell className="font-medium">{fmtMoney(r.quantity * r.rate * d)}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => delPE.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Equipa técnica</CardTitle>
              <Select onValueChange={(v) => v && addCrew.mutate(v)}>
                <SelectTrigger className="w-72"><SelectValue placeholder="+ Adicionar membro" /></SelectTrigger>
                <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0,8)}</SelectItem>)}</SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Pessoa</TableHead><TableHead>Função</TableHead>
                  <TableHead className="w-28">€/dia</TableHead><TableHead className="w-28">Custo/dia</TableHead>
                  <TableHead className="w-28">Total</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {caItems.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center py-6">Sem equipa</TableCell></TableRow>}
                  {caItems.map((r) => {
                    const d = dayDiff(r.start_date, r.end_date, days);
                    return <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.profiles?.full_name ?? "—"}</TableCell>
                      <TableCell><Input className="h-8" defaultValue={r.role} onBlur={(e) => updateCA.mutate({ id: r.id, role: e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" className="h-8" defaultValue={r.daily_rate} onBlur={(e) => updateCA.mutate({ id: r.id, daily_rate: +e.target.value })} /></TableCell>
                      <TableCell><Input type="number" step="0.01" className="h-8" defaultValue={r.cost_rate} onBlur={(e) => updateCA.mutate({ id: r.id, cost_rate: +e.target.value })} /></TableCell>
                      <TableCell className="font-medium">{fmtMoney(r.daily_rate * d)}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => delCA.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-6 px-2 text-sm">
            <span className="text-muted-foreground">{days} dia{days>1?"s":""} de evento</span>
            <span>Subtotal: <strong>{fmtMoney(subtotal)}</strong></span>
          </div>
        </TabsContent>

        <TabsContent value="tiers">
          <Card><CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">Apresenta 3 opções no PDF. O nível "Essencial" é o subtotal calculado automaticamente. Os outros dois ancoram a perceção de valor — preenche apenas se quiseres usar.</p>
            <div className="grid grid-cols-3 gap-4">
              <Card><CardHeader><CardTitle className="text-sm">Essencial (auto)</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{fmtMoney(subtotal)}</p><p className="text-xs text-muted-foreground mt-1">Calculado dos itens</p></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Plus</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Input type="number" step="0.01" placeholder="0.00" value={edit.tier_silver_amount ?? ""} onChange={(e) => setEdit({ ...edit, tier_silver_amount: e.target.value === "" ? null : +e.target.value })} />
                  <p className="text-xs text-muted-foreground">Reforço PA + 1 técnico extra</p>
                </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Premium</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Input type="number" step="0.01" placeholder="0.00" value={edit.tier_gold_amount ?? ""} onChange={(e) => setEdit({ ...edit, tier_gold_amount: e.target.value === "" ? null : +e.target.value })} />
                  <p className="text-xs text-muted-foreground">Topo de gama, redundância, equipa alargada</p>
                </CardContent></Card>
            </div>
            <p className="text-xs text-muted-foreground">Lembra-te de carregar em Guardar.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="incl">
          <Card><CardContent className="grid grid-cols-2 gap-6 pt-6">
            <div className="space-y-2">
              <Label className="text-emerald-700">✓ Inclui (uma linha por item)</Label>
              <Textarea rows={10} value={(edit.included_items ?? []).join("\n")} onChange={(e) => setEdit({ ...edit, included_items: e.target.value.split("\n").filter(Boolean) })} />
              <Button variant="outline" size="sm" type="button" onClick={() => setEdit({ ...edit, included_items: DEFAULT_INCLUDED })}>Carregar predefinidos</Button>
            </div>
            <div className="space-y-2">
              <Label className="text-red-700">✗ Não inclui (uma linha por item)</Label>
              <Textarea rows={10} value={(edit.excluded_items ?? []).join("\n")} onChange={(e) => setEdit({ ...edit, excluded_items: e.target.value.split("\n").filter(Boolean) })} />
              <Button variant="outline" size="sm" type="button" onClick={() => setEdit({ ...edit, excluded_items: DEFAULT_EXCLUDED })}>Carregar predefinidos</Button>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="margin">
          <Card><CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">Vista interna — não aparece no PDF do cliente. Define os <strong>custos</strong> em cada linha para calcular margem real.</p>
            <div className="grid grid-cols-4 gap-4">
              <Stat label="Receita (preço)" value={fmtMoney(subtotal)} />
              <Stat label="Custo total" value={fmtMoney(totalCost)} muted />
              <Stat label="Margem €" value={fmtMoney(margin)} accent={margin >= 0 ? "good" : "bad"} />
              <Stat label="Margem %" value={`${marginPct.toFixed(1)}%`} accent={marginPct >= 30 ? "good" : marginPct >= 15 ? "warn" : "bad"} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card><CardHeader><CardTitle className="text-sm">Por secção</CardTitle></CardHeader>
                <CardContent>
                  <BySection peItems={peItems} caItems={caItems} days={days} />
                </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Recomendações</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-2 text-muted-foreground">
                  <p>• Margem &gt; 35%: zona saudável para serviços completos com técnico em standby.</p>
                  <p>• Margem 20–35%: aceitável; valida se o transporte e refeições estão contabilizados.</p>
                  <p>• Margem &lt; 20%: cuidado — pequenos imprevistos podem dar prejuízo. Considera subir preço ou reduzir crew/equipamento.</p>
                </CardContent></Card>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Stat({ label, value, muted, accent }: { label: string; value: string; muted?: boolean; accent?: "good"|"warn"|"bad" }) {
  const color = accent === "good" ? "text-emerald-600" : accent === "warn" ? "text-amber-600" : accent === "bad" ? "text-red-600" : muted ? "text-muted-foreground" : "";
  return <Card><CardContent className="pt-6">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
  </CardContent></Card>;
}

function BySection({ peItems, caItems, days }: { peItems: PE[]; caItems: CA[]; days: number }) {
  const map: Record<string, { rev: number; cost: number }> = {};
  peItems.forEach((r) => {
    const d = dayDiff(r.pickup_date, r.return_date, days);
    const k = r.section || "other";
    map[k] ||= { rev: 0, cost: 0 };
    map[k].rev += r.quantity * r.rate * d;
    map[k].cost += r.quantity * r.cost_rate * d;
  });
  caItems.forEach((r) => {
    const d = dayDiff(r.start_date, r.end_date, days);
    const k = r.section || "crew";
    map[k] ||= { rev: 0, cost: 0 };
    map[k].rev += r.daily_rate * d;
    map[k].cost += r.cost_rate * d;
  });
  const rows = Object.entries(map);
  if (!rows.length) return <p className="text-sm text-muted-foreground">Sem itens.</p>;
  return <Table>
    <TableHeader><TableRow><TableHead>Secção</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Margem</TableHead></TableRow></TableHeader>
    <TableBody>{rows.map(([k, v]) => {
      const m = v.rev - v.cost;
      const pct = v.rev > 0 ? (m / v.rev) * 100 : 0;
      return <TableRow key={k}>
        <TableCell>{sectionLabel(k)}</TableCell>
        <TableCell className="text-right">{fmtMoney(v.rev)}</TableCell>
        <TableCell className="text-right text-muted-foreground">{fmtMoney(v.cost)}</TableCell>
        <TableCell className={`text-right font-medium ${m >= 0 ? "" : "text-red-600"}`}>{fmtMoney(m)} <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span></TableCell>
      </TableRow>;
    })}</TableBody>
  </Table>;
}