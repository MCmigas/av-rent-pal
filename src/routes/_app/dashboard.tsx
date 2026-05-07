import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Package, Calendar, Users, FileText } from "lucide-react";
import { fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Eurosom" }] }),
  component: Dashboard,
});

function Dashboard() {
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [eq, pj, cw, inv] = await Promise.all([
        supabase.from("equipment").select("id, daily_rate", { count: "exact" }),
        supabase.from("projects").select("id, status, total_amount", { count: "exact" }),
        supabase.from("crew_assignments").select("id", { count: "exact", head: true }),
        supabase.from("invoices").select("amount, status"),
      ]);
      const open = (pj.data ?? []).filter((p) => p.status !== "completed").length;
      const revenue = (inv.data ?? []).filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
      const outstanding = (inv.data ?? []).filter((i) => i.status !== "paid").reduce((s, i) => s + Number(i.amount), 0);
      return {
        equipment: eq.count ?? 0,
        projects: pj.count ?? 0,
        openProjects: open,
        crew: cw.count ?? 0,
        revenue, outstanding,
      };
    },
  });

  const cards = [
    { label: "Equipamentos", value: stats.data?.equipment ?? 0, icon: Package },
    { label: "Projetos ativos", value: stats.data?.openProjects ?? 0, icon: Calendar },
    { label: "Crew bookings", value: stats.data?.crew ?? 0, icon: Users },
    { label: "Receita paga", value: fmtMoney(stats.data?.revenue ?? 0), icon: FileText },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão geral da operação Eurosom" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold">Em aberto</h3>
          <p className="mt-2 text-3xl font-bold text-primary">{fmtMoney(stats.data?.outstanding ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Faturas por receber</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold">Total de projetos</h3>
          <p className="mt-2 text-3xl font-bold">{stats.data?.projects ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Histórico completo</p>
        </div>
      </div>
    </>
  );
}
