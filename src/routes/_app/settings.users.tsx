import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_app/settings/users")({
  head: () => ({ meta: [{ title: "Utilizadores — Eurosom" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: UsersPage,
});

function UsersPage() {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, organizationId } = usePermissions();
  const qc = useQueryClient();

  const canManage = isAdmin || isSuperAdmin;

  const profilesQ = useQuery({
    enabled: !!organizationId,
    queryKey: ["perm-profiles", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permission_profiles")
        .select("id, name, is_system, permissions")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const usersQ = useQuery({
    enabled: !!organizationId,
    queryKey: ["org-users", organizationId],
    queryFn: async () => {
      const { data: upps, error } = await supabase
        .from("user_permission_profiles")
        .select("user_id, profile_id, organization_id, permission_profiles(name, is_system)")
        .eq("organization_id", organizationId!);
      if (error) throw error;
      const ids = (upps ?? []).map((u: any) => u.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as any[] };
      const nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      return (upps ?? []).map((u: any) => ({
        user_id: u.user_id,
        profile_id: u.profile_id,
        profile_name: u.permission_profiles?.name ?? "—",
        is_system: u.permission_profiles?.is_system ?? false,
        full_name: nameMap.get(u.user_id) ?? "(sem nome)",
      }));
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (vars: { user_id: string; profile_id: string }) => {
      const { error } = await supabase
        .from("user_permission_profiles")
        .update({ profile_id: vars.profile_id })
        .eq("user_id", vars.user_id)
        .eq("organization_id", organizationId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["org-users", organizationId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  if (!canManage) {
    return (
      <>
        <PageHeader title="Utilizadores" subtitle="Gestão de equipa e permissões" />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Apenas administradores podem gerir utilizadores.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Utilizadores"
        subtitle="Equipa com acesso à plataforma e respetivos perfis de permissões"
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {usersQ.isLoading && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">A carregar…</td></tr>
            )}
            {usersQ.data?.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Sem utilizadores.</td></tr>
            )}
            {usersQ.data?.map((u) => {
              const isSelf = u.user_id === user?.id;
              return (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.full_name}</div>
                    {isSelf && <div className="text-xs text-muted-foreground">(você)</div>}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={u.profile_id}
                      disabled={isSelf || updateProfile.isPending}
                      onValueChange={(v) => updateProfile.mutate({ user_id: u.user_id, profile_id: v })}
                    >
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {profilesQ.data?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.profile_name === "Administrador" ? (
                      <Badge className="gap-1 bg-primary text-primary-foreground"><ShieldCheck className="h-3 w-3" /> Admin</Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1"><ShieldAlert className="h-3 w-3" /> {u.profile_name}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Não pode alterar o seu próprio perfil — peça a outro administrador. Convites por email serão adicionados na próxima fase.
      </p>
    </>
  );
}