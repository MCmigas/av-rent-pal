import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import {
  LayoutDashboard, Package, Calendar, Users, FileText, LogOut, Settings,
  Wrench, Receipt, Wallet, ClipboardCheck, BarChart3,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LocationSelector } from "@/components/LocationSelector";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: any; perm?: string; adminOnly?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "Geral",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operações",
    items: [
      { to: "/calendar", label: "Calendário", icon: Calendar, perm: "equipment.view" },
      { to: "/projects", label: "Projetos", icon: Calendar, perm: "projects.view" },
      { to: "/equipment", label: "Equipamento", icon: Package, perm: "equipment.view" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { to: "/invoices", label: "Faturas", icon: Receipt, perm: "invoices.view" },
    ],
  },
  {
    label: "Equipa",
    items: [
      { to: "/crew", label: "Crew", icon: Users, perm: "crew.view" },
    ],
  },
  {
    label: "Definições",
    items: [
      { to: "/settings/users", label: "Utilizadores", icon: Settings, adminOnly: true },
      { to: "/settings/profiles", label: "Perfis de Permissões", icon: ShieldCheck, adminOnly: true },
    ],
  },
];

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { can, isAdmin, isSuperAdmin } = usePermissions();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/login" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const logout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const showItem = (it: NavItem) => {
    if (it.adminOnly) return isAdmin || isSuperAdmin;
    if (it.perm) return can(it.perm);
    return true;
  };

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter(showItem) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <div className="px-2 py-3"><Logo className="h-8" /></div>
        <div className="mt-3"><LocationSelector /></div>
        <nav className="mt-6 flex flex-1 flex-col gap-4 overflow-y-auto">
          {visibleGroups.map((g) => (
            <div key={g.label}>
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {g.label}
              </div>
              <div className="flex flex-col gap-1">
                {g.items.map((n) => {
                  const active = location.pathname.startsWith(n.to);
                  return (
                    <Link key={n.to} to={n.to}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                        active ? "bg-primary text-primary-foreground font-semibold" : "text-sidebar-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      <n.icon className="h-4 w-4" />{n.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-3">
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" onClick={logout} className="w-full justify-start">
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex-1 overflow-x-hidden">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <Logo className="h-7" />
          <div className="flex-1"><LocationSelector /></div>
          <Button variant="ghost" size="icon" onClick={logout}><LogOut className="h-4 w-4" /></Button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2 md:hidden">
          {visibleGroups.flatMap((g) => g.items).map((n) => {
            const active = location.pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                <n.icon className="h-3.5 w-3.5" />{n.label}
              </Link>
            );
          })}
        </nav>
        <main className="p-6"><Outlet /></main>
      </div>
    </div>
  );
}
