import { createFileRoute } from "@tanstack/react-router";
import { Logo, PublicFooter } from "@/components/brand";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Termos de uso — TaskFlow" },
      { name: "description", content: "Regras de uso do TaskFlow." },
      { property: "og:title", content: "Termos de uso — TaskFlow" },
      { property: "og:description", content: "Regras de uso do TaskFlow." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="min-h-screen">
      <header className="mx-auto max-w-3xl px-6 py-5">
        <Logo />
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-6 pb-16">
        <h1 className="text-4xl font-bold">Termos de uso</h1>
        <p className="text-sm text-muted-foreground">Atualizados em 1º de novembro de 2026.</p>
        <p>
          O TaskFlow serve para organizar tarefas pessoais e em grupo. Você é responsável pelo
          conteúdo que cria, pelos convites que envia e por manter a senha (ou a conta Google, se
          estiver habilitada) em segurança.
        </p>
        <p>
          Quem entra num grupo pelo link de convite passa a ver as tarefas e os comentários daquele
          grupo. Contas usadas para abuso, spam ou tentativa de acessar dados de outras pessoas
          podem ser suspensas.
        </p>
        <p>
          Ao excluir a conta, as tarefas pessoais somem. Tarefas de grupo podem permanecer com os
          colegas, conforme a política de privacidade.
        </p>
      </main>
      <PublicFooter />
    </div>
  ),
});