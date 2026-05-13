import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtMoney } from "@/lib/format";
import { AlertCircle } from "lucide-react";

export function MaintenanceView() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["maintenance-all"],
    queryFn: async () => {
      const [{ data: m, error: e1 }, { data: eq, error: e2 }] = await Promise.all([
        supabase.from("equipment_maintenance").select("*").order("performed_at", { ascending: false }),
        supabase.from("equipment").select("id, name"),
      ]);
      if (e1) throw e1; if (e2) throw e2;
      const map = new Map((eq ?? []).map((e: any) => [e.id, e.name]));
      return (m ?? []).map((r: any) => ({ ...r, equipmentName: map.get(r.equipment_id) ?? "—" }));
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rows.filter((r: any) => r.next_due && r.next_due >= today)
    .sort((a: any, b: any) => a.next_due.localeCompare(b.next_due)).slice(0, 5);
  const overdue = rows.filter((r: any) => r.next_due && r.next_due < today);

  return (
    <div className="space-y-6">
      {(upcoming.length > 0 || overdue.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overdue.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <h3 className="font-semibold text-sm">Em atraso ({overdue.length})</h3>
              </div>
              <ul className="text-sm space-y-1">
                {overdue.slice(0, 5).map((r: any) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{r.equipmentName}</span>
                    <span className="text-destructive">{fmtDate(r.next_due)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {upcoming.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-sm mb-2">Próximas revisões</h3>
              <ul className="text-sm space-y-1">
                {upcoming.map((r: any) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{r.equipmentName}</span>
                    <span className="text-muted-foreground">{fmtDate(r.next_due)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Próxima</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead>Descrição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">A carregar...</TableCell></TableRow>}
            {!isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem registos de manutenção.</TableCell></TableRow>
            )}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{fmtDate(r.performed_at)}</TableCell>
                <TableCell className="font-medium">{r.equipmentName}</TableCell>
                <TableCell><Badge variant="secondary">{r.type}</Badge></TableCell>
                <TableCell>{fmtDate(r.next_due)}</TableCell>
                <TableCell>{r.cost > 0 ? fmtMoney(Number(r.cost)) : "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-md truncate">{r.description ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}