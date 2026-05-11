import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

const searchSchema = z.object({ token: z.string().uuid().optional() });

export const Route = createFileRoute("/accept-invite")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Aceitar convite — Eurosom" }] }),
  component: AcceptInvitePage,
});

type Invite = {
  id: string;
  email: string;
  organization_id: string;
  organization_name: string;
  profile_id: string;
  profile_name: string;
  expires_at: string;
  accepted_at: string | null;
};

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) { setLookupError("Link inválido."); return; }
    (async () => {
      const { data, error } = await supabase.rpc("get_invite_by_token", { _token: token });
      if (error) { setLookupError(error.message); return; }
      const row = (data as Invite[] | null)?.[0];
      if (!row) { setLookupError("Convite não encontrado."); return; }
      if (row.accepted_at) { setLookupError("Este convite já foi aceite."); return; }
      if (new Date(row.expires_at) < new Date()) { setLookupError("Este convite expirou."); return; }
      setInvite(row);
    })();
  }, [token]);

  const accept = async () => {
    if (!token) return;
    const { error } = await supabase.rpc("accept_invite", { _token: token });
    if (error) throw error;
  };

  const onSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setLoading(true);
    try {
      const { error: signUpErr } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
          data: { full_name: fullName },
        },
      });
      if (signUpErr) throw signUpErr;
      // Try password sign-in directly (works if email confirmation off)
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: invite.email, password,
      });
      if (signInErr) {
        toast.success("Conta criada — confirme o email e volte a abrir o link.");
        return;
      }
      await accept();
      toast.success(`Bem-vindo à ${invite.organization_name}`);
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally { setLoading(false); }
  };

  const onAcceptAsCurrent = async () => {
    setLoading(true);
    try {
      await accept();
      toast.success(`Adicionado a ${invite?.organization_name}`);
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
        <Link to="/" className="flex justify-center"><Logo className="h-12" /></Link>

        {lookupError && (
          <>
            <h1 className="mt-6 text-center text-xl font-bold">Convite indisponível</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">{lookupError}</p>
            <Link to="/" className="mt-6 block text-center text-sm text-primary hover:underline">Voltar ao início</Link>
          </>
        )}

        {!lookupError && invite && (
          <>
            <h1 className="mt-6 text-center text-2xl font-bold">Convite</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              <strong className="text-foreground">{invite.organization_name}</strong> convidou-o
              como <strong className="text-foreground">{invite.profile_name}</strong>.
            </p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Email: <strong className="text-foreground">{invite.email}</strong>
            </p>

            {authLoading && <p className="mt-6 text-center text-sm text-muted-foreground">A carregar…</p>}

            {!authLoading && user && user.email?.toLowerCase() === invite.email.toLowerCase() && (
              <Button className="mt-6 w-full" disabled={loading} onClick={onAcceptAsCurrent}>
                {loading ? "..." : "Aceitar convite"}
              </Button>
            )}

            {!authLoading && user && user.email?.toLowerCase() !== invite.email.toLowerCase() && (
              <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                Está autenticado como <strong>{user.email}</strong>, mas o convite é para <strong>{invite.email}</strong>.
                Termine sessão e tente novamente.
              </div>
            )}

            {!authLoading && !user && (
              <form onSubmit={onSignupAndAccept} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={invite.email} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Palavra-passe</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "..." : "Criar conta e aceitar"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Já tem conta com este email?{" "}
                  <Link to="/login" className="text-primary hover:underline">Entrar primeiro</Link>
                </p>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}