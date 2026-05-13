import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, Pencil, Trash2, Search, LayoutGrid, List, Download, Upload, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { fmtMoney } from "@/lib/format";
import { EquipmentDialog } from "./EquipmentDialog";
import type { Equipment } from "./types";

const CATS: Record<string, string> = { audio: "Som", video: "Vídeo", lighting: "Iluminação", staging: "Estrutura", cabling: "Cabos", other: "Outros" };
const STATUS: Record<string, string> = { available: "Disponível", rented: "Alugado", maintenance: "Manutenção", retired: "Reformado" };

export function EquipmentInventory() {
  const qc = useQueryClient();
  const { organizationId, can } = usePermissions();
  const canManage = can("equipment.manage");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Equipment> | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"table" | "grid">("table");
  const [sortBy, setSortBy] = useState<"name" | "category" | "daily_rate" | "quantity">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").order("name");
      if (error) throw error;
      return data as Equipment[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["equipment"] }); toast.success("Eliminado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let r = items;
    if (search) {
      const s = search.toLowerCase();
      r = r.filter((i) => [i.name, i.brand, i.model, i.serial_number].some((v) => v?.toLowerCase().includes(s)));
    }
    if (catFilter !== "all") r = r.filter((i) => i.category === catFilter);
    if (statusFilter !== "all") r = r.filter((i) => i.status === statusFilter);
    r = [...r].sort((a, b) => {
      const av = a[sortBy] ?? ""; const bv = b[sortBy] ?? "";
      const cmp = typeof av === "number" ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [items, search, catFilter, statusFilter, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("asc"); }
  };

  const exportCSV = () => {
    const rows = filtered.map((i) => ({
      name: i.name, category: i.category, brand: i.brand ?? "", model: i.model ?? "",
      serial_number: i.serial_number ?? "", quantity: i.quantity, daily_rate: i.daily_rate,
      status: i.status, condition: i.condition, notes: i.notes ?? "",
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventario-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const importCSV = (file: File) => {
    if (!organizationId) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (res) => {
        const rows = (res.data as any[]).map((r) => ({
          organization_id: organizationId,
          name: r.name, category: r.category || "other",
          brand: r.brand || null, model: r.model || null, serial_number: r.serial_number || null,
          quantity: parseInt(r.quantity) || 1, daily_rate: parseFloat(r.daily_rate) || 0,
          status: r.status || "available", condition: r.condition || "good",
          notes: r.notes || null,
        })).filter((r) => r.name);
        if (!rows.length) { toast.error("CSV vazio ou sem coluna 'name'"); return; }
        const { error } = await supabase.from("equipment").insert(rows);
        if (error) toast.error(error.message);
        else { toast.success(`${rows.length} itens importados`); qc.invalidateQueries({ queryKey: ["equipment"] }); }
      },
    });
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Procurar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Categoria</SelectItem>
            {Object.entries(CATS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Estado</SelectItem>
            {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as any)}>
          <ToggleGroupItem value="table"><List className="h-4 w-4" /></ToggleGroupItem>
          <ToggleGroupItem value="grid"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
        </ToggleGroup>
        <Button variant="outline" size="icon" onClick={exportCSV} title="Exportar CSV"><Download className="h-4 w-4" /></Button>
        {canManage && (
          <>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) { importCSV(e.target.files[0]); e.target.value = ""; } }} />
            <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()} title="Importar CSV"><Upload className="h-4 w-4" /></Button>
            <Button onClick={() => { setEditing({}); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Novo
            </Button>
          </>
        )}
      </div>

      {view === "table" ? (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("name")}>
                  <span className="inline-flex items-center gap-1">Nome <ArrowUpDown className="h-3 w-3" /></span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("category")}>Categoria</TableHead>
                <TableHead>Marca/Modelo</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("quantity")}>Qtd</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("daily_rate")}>Diária</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">A carregar...</TableCell></TableRow>}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sem resultados.</TableCell></TableRow>
              )}
              {filtered.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    {i.image_url ? (
                      <img src={i.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : <div className="h-10 w-10 rounded bg-muted" />}
                  </TableCell>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell><Badge variant="secondary">{CATS[i.category] ?? i.category}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{[i.brand, i.model].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell>{i.quantity}</TableCell>
                  <TableCell>{fmtMoney(Number(i.daily_rate))}</TableCell>
                  <TableCell><Badge variant={i.status === "available" ? "default" : "outline"}>{STATUS[i.status] ?? i.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => confirm(`Eliminar "${i.name}"?`) && del.mutate(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((i) => (
            <button key={i.id} onClick={() => { setEditing(i); setOpen(true); }}
              className="text-left rounded-xl border border-border bg-card overflow-hidden hover:border-primary transition-colors">
              <div className="aspect-square bg-muted">
                {i.image_url ? <img src={i.image_url} alt="" className="h-full w-full object-cover" />
                  : <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">Sem foto</div>}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-sm line-clamp-1">{i.name}</div>
                  <Badge variant={i.status === "available" ? "default" : "outline"} className="shrink-0">{STATUS[i.status] ?? i.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{[i.brand, i.model].filter(Boolean).join(" ") || CATS[i.category]}</div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Qtd {i.quantity}</span>
                  <span className="font-medium">{fmtMoney(Number(i.daily_rate))}/dia</span>
                </div>
              </div>
            </button>
          ))}
          {!isLoading && filtered.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-12">Sem resultados.</div>
          )}
        </div>
      )}

      <EquipmentDialog open={open} onOpenChange={setOpen} item={editing} />
    </>
  );
}