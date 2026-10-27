import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, LayoutDashboard, ListTodo, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, PublicFooter } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import hero from "@/assets/hero-desk.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TaskFlow — Gerencie suas tarefas com foco e segurança" },
      {
        name: "description",
        content:
          "Crie, conclua e acompanhe tarefas pessoais e profissionais em um painel claro — com seus dados isolados por conta.",
      },
      { property: "og:title", content: "TaskFlow — Gerencie suas tarefas com foco e segurança" },
      {
        property: "og:description",
        content: "Painel de tarefas com dados privados por conta e exportação quando você quiser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: LayoutDashboard,
    title: "Painel em tempo real",
    text: "Pendentes, em andamento e concluídas calculadas a partir das suas tarefas.",
  },
  {
    icon: ListTodo,
    title: "Lista sem atrito",
    text: "Crie, marque como feita e exclua tarefas em um painel direto.",
  },
  {
    icon: ShieldCheck,
    title: "Privado por padrão",
    text: "Cada conta só vê os próprios dados. Isolamento no banco, não só na interface.",
  },
  {
    icon: Download,
    title: "Seus dados, suas regras",
    text: "Exporte um arquivo com o que a conta guarda, ou exclua a conta e o que veio com ela.",
  },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      // Returning from a social sign-in: continue to the app.
      if (data.session && sessionStorage.getItem("tf_post_oauth")) {
        sessionStorage.removeItem("tf_post_oauth");
        navigate({ to: "/dashboard" });
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Conta">
          {signedIn ? (
            <Button asChild>
              <Link to="/dashboard">Abrir painel</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth" search={{ mode: "signin" }}>
                  Entrar
                </Link>
              </Button>
              <Button asChild>
                <Link to="/auth" search={{ mode: "signup" }}>
                  Criar conta
                </Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-2 lg:pt-16">
          <div className="animate-rise">
            <p className="mb-5 inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
              Produtividade sem bagunça
            </p>
            <h1 className="text-5xl font-extrabold leading-[1.02] sm:text-6xl">
              Suas tarefas,
              <br />
              <span className="text-primary">em fluxo.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              Organize o trabalho e a vida pessoal em um só lugar. Crie tarefas, marque o que foi
              feito e acompanhe o progresso no painel.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="hero" asChild>
                <Link to="/auth" search={{ mode: "signup" }}>
                  Começar grátis
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth" search={{ mode: "signin" }}>
                  Já tenho conta
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative animate-rise [animation-delay:120ms]">
            <div aria-hidden className="absolute -inset-4 -z-10 rounded-3xl bg-secondary" />
            <img
              src={hero}
              alt="Mesa organizada com lista de tarefas concluídas"
              width={1280}
              height={960}
              className="rounded-2xl shadow-lift"
            />
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-20 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <article key={f.title} className="rounded-xl bg-card p-6 shadow-soft">
                <f.icon className="size-6 text-primary" aria-hidden />
                <h2 className="mt-4 text-lg font-bold">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
