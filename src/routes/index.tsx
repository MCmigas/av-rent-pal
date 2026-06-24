import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Package, Users, FileText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eurosom — AV Production Management" },
      { name: "description", content: "Gestão completa de equipamento, projetos, equipas e faturação para a Produções Eurosom." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Logo className="h-14" />
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/login">Entrar</Link></Button>
            <Button asChild><Link to="/login" search={{ mode: "signup" }}>Criar conta</Link></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-6 py-24 text-center">
          <div className="mx-auto inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1 text-xs font-medium uppercase tracking-widest text-primary">
            Audio · Vídeo · Iluminação
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-tight md:text-6xl">
            A central de operações da <span className="text-primary">Produções Eurosom</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Gere o teu inventário, projetos, equipas e faturação num só lugar.
            Construído à medida da tua produtora audiovisual.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Button asChild size="lg" className="shadow-[var(--shadow-brand)]">
              <Link to="/login" search={{ mode: "signup" }}>Começar</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Já tenho conta</Link>
            </Button>
          </div>
        </section>

        <section className="container mx-auto grid gap-6 px-6 pb-24 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Package, title: "Inventário", desc: "Todo o equipamento de som, vídeo e luz com estado e disponibilidade." },
            { icon: Calendar, title: "Projetos", desc: "Orçamentos, eventos e bookings com cliente, local e datas." },
            { icon: Users, title: "Equipa", desc: "Atribui técnicos a cada projeto com função e diária." },
            { icon: FileText, title: "Faturação", desc: "Emite faturas a partir dos projetos e acompanha pagamentos." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Produções Eurosom
      </footer>
    </div>
  );
}
