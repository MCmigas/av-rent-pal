import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  format, isSameMonth, isSameDay, parseISO,
} from "date-fns";
import { pt } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/calendar")({
  head: () => ({ meta: [{ title: "Calendário — Eurosom" }] }),
  component: CalendarPage,
});

type Booking = {
  id: string;
  project_id: string;
  equipment_id: string;
  quantity: number;
  pickup_date: string | null;
  return_date: string | null;
  notes: string | null;
  projects: { title: string; status: string; start_date: string | null; end_date: string | null } | null;
  equipment: { name: string; quantity: number } | null;
};

const statusColor = (s: string) => {
  switch (s) {
    case "confirmed": return "bg-primary text-primary-foreground";
    case "in_progress": return "bg-accent text-accent-foreground";
    case "quote": return "bg-muted text-muted-foreground";
    case "completed": return "bg-secondary text-secondary-foreground line-through";
    case "cancelled": return "bg-destructive/40 text-destructive-foreground line-through";
    default: return "bg-muted text-muted-foreground";
  }
};

function CalendarPage() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [open, setOpen] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { data: bookings = [] } = useQuery({
    queryKey: ["calendar-bookings", gridStart.toISOString(), gridEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_equipment")
        .select(`
          id, project_id, equipment_id, quantity, pickup_date, return_date, notes,
          projects:project_id ( title, status, start_date, end_date ),
          equipment:equipment_id ( name, quantity )
        `)
        .order("pickup_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      // Filter client-side for visible window using effective dates
      return (data as unknown as Booking[]).filter((b) => {
        const start = b.pickup_date ?? b.projects?.start_date ?? null;
        const end = b.return_date ?? b.projects?.end_date ?? null;
        if (!start || !end) return false;
        const s = new Date(start);
        const e = new Date(end);
        return e >= gridStart && s <= gridEnd;
      });
    },
  });

  const days = useMemo(() => {
    const arr: Date[] = [];
    let d = gridStart;
    while (d <= gridEnd) { arr.push(d); d = addDays(d, 1); }
    return arr;
  }, [gridStart, gridEnd]);

  const dayBookings = (day: Date) =>
    bookings.filter((b) => {
      const s = parseISO((b.pickup_date ?? b.projects?.start_date)!);
      const e = parseISO((b.return_date ?? b.projects?.end_date)!);
      return day >= new Date(s.getFullYear(), s.getMonth(), s.getDate())
          && day <= new Date(e.getFullYear(), e.getMonth(), e.getDate());
    });

  return (
    <>
      <PageHeader title="Calendário de aluguer" subtitle="Reservas e disponibilidade de equipamento">
        <Button onClick={() => { setDefaultDate(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Nova reserva
        </Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
              Hoje
            </Button>
          </div>
          <h2 className="text-lg font-semibold capitalize">
            {format(cursor, "MMMM 'de' yyyy", { locale: pt })}
          </h2>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((d) => (
            <div key={d} className="px-2 py-1 text-center font-semibold uppercase text-muted-foreground">{d}</div>
          ))}
          {days.map((day) => {
            const inMonth = isSameMonth(day, cursor);
            const today = isSameDay(day, new Date());
            const items = dayBookings(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => { setDefaultDate(day); setOpen(true); }}
                className={`min-h-[96px] rounded-md border p-1 text-left transition hover:border-primary ${
                  inMonth ? "border-border bg-background" : "border-border/40 bg-muted/30 text-muted-foreground"
                } ${today ? "ring-1 ring-primary" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className={`text-xs ${today ? "font-bold text-primary" : ""}`}>{format(day, "d")}</span>
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((b) => (
                    <div
                      key={b.id}
                      className={`truncate rounded px-1 py-0.5 text-[10px] ${statusColor(b.projects?.status ?? "")}`}
                      title={`${b.projects?.title} — ${b.equipment?.name} ×${b.quantity}`}
                    >
                      {b.equipment?.name} ×{b.quantity}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="px-1 text-[10px] text-muted-foreground">+{items.length - 3} mais</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <Legend color="bg-muted" label="Orçamento" />
          <Legend color="bg-primary" label="Confirmado" />
          <Legend color="bg-accent" label="Em curso" />
          <Legend color="bg-secondary" label="Concluído" />
        </div>
      </div>

      <ReservationDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) qc.invalidateQueries({ queryKey: ["calendar-bookings"] }); }}
        defaultDate={defaultDate}
      />
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-4 rounded-sm ${color}`} />
      {label}
    </div>
  );
}

/* ---------- Reservation dialog ---------- */

type Eq = { id: string; name: string; quantity: number };
type Proj = { id: string; title: string; status: string; start_date: string | null; end_date: string | null };

function ReservationDialog({
  open, onOpenChange, defaultDate,
}: { open: boolean; onOpenChange: (v: boolean) => void; defaultDate: Date | null }) {
  const qc = useQueryClient();
  const toInput = (d?: string | null | Date) => {
    if (!d) return "";
    const dt = typeof d === "string" ? new Date(d) : d;
    const tz = dt.getTimezoneOffset() * 60000;
    return new Date(dt.getTime() - tz).toISOString().slice(0, 16);
  };

  const [projectId, setProjectId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [pickup, setPickup] = useState(toInput(defaultDate ?? new Date()));
  const [returnD, setReturnD] = useState(toInput(defaultDate ? addDays(defaultDate, 1) : addDays(new Date(), 1)));
  const [notes, setNotes] = useState("");

  // Reset on open
  useMemo(() => {
    if (open) {
      setPickup(toInput(defaultDate ?? new Date()));
      setReturnD(toInput(defaultDate ? addDays(defaultDate, 1) : addDays(new Date(), 1)));
      setQuantity(1); setNotes("");
    }
  }, [open, defaultDate]);

  const equipQ = useQuery({
    enabled: open,
    queryKey: ["all-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("id, name, quantity").order("name");
      if (error) throw error; return data as Eq[];
    },
  });

  const projQ = useQuery({
    enabled: open,
    queryKey: ["bookable-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, status, start_date, end_date")
        .in("status", ["quote", "confirmed", "in_progress"])
        .order("start_date", { ascending: false, nullsFirst: false });
      if (error) throw error; return data as Proj[];
    },
  });

  const availQ = useQuery({
    enabled: !!equipmentId && !!pickup && !!returnD,
    queryKey: ["availability", equipmentId, pickup, returnD],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("equipment_availability", {
        _equipment_id: equipmentId,
        _from: new Date(pickup).toISOString(),
        _to: new Date(returnD).toISOString(),
      });
      if (error) throw error;
      return data as number;
    },
  });

  const eq = equipQ.data?.find((e) => e.id === equipmentId);
  const stock = eq?.quantity ?? 0;

  const save = useMutation({
    mutationFn: async () => {
      if (!projectId || !equipmentId) throw new Error("Escolha projeto e equipamento");
      if (new Date(returnD) <= new Date(pickup)) throw new Error("Data de devolução tem de ser posterior à recolha");
      const { error } = await supabase.from("project_equipment").insert({
        project_id: projectId,
        equipment_id: equipmentId,
        quantity,
        pickup_date: new Date(pickup).toISOString(),
        return_date: new Date(returnD).toISOString(),
        notes: notes || null,
        rate: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reserva criada");
      qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao reservar"),
  });

  const proj = projQ.data?.find((p) => p.id === projectId);
  const projectIsConfirmed = proj?.status === "confirmed" || proj?.status === "in_progress";
  const overbooking = projectIsConfirmed && availQ.data !== undefined && quantity > availQ.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Nova reserva</DialogTitle></DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Projeto</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Escolher projeto" /></SelectTrigger>
              <SelectContent>
                {projQ.data?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title} <span className="text-xs text-muted-foreground">({p.status})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projQ.data?.length === 0 && (
              <p className="text-xs text-muted-foreground">Cria primeiro um projeto em Operações → Projetos.</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Equipamento</Label>
            <Select value={equipmentId} onValueChange={setEquipmentId}>
              <SelectTrigger><SelectValue placeholder="Escolher equipamento" /></SelectTrigger>
              <SelectContent>
                {equipQ.data?.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name} ({e.quantity} em stock)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Recolha</Label>
              <Input type="datetime-local" value={pickup} onChange={(e) => setPickup(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Devolução</Label>
              <Input type="datetime-local" value={returnD} onChange={(e) => setReturnD(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Quantidade</Label>
            <Input
              type="number" min={1} max={stock || undefined}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, +e.target.value))}
            />
            {equipmentId && availQ.data !== undefined && (
              <div className="text-xs">
                <Badge variant={overbooking ? "destructive" : "secondary"}>
                  {availQ.data} disponíveis nesse intervalo (de {stock} em stock)
                </Badge>
                {!projectIsConfirmed && (
                  <span className="ml-2 text-muted-foreground">
                    Orçamento — não bloqueia stock até ser confirmado.
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {overbooking && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              Sem stock suficiente para um projeto confirmado. Reduza a quantidade ou ajuste as datas.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending || overbooking}>
            {save.isPending ? "..." : "Reservar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}