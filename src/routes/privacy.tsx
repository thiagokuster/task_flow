import { createFileRoute } from "@tanstack/react-router";
import { Logo, PublicFooter } from "@/components/brand";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — TaskFlow" },
      { name: "description", content: "Como o TaskFlow coleta, usa e protege seus dados pessoais." },
      { property: "og:title", content: "Política de privacidade — TaskFlow" },
      { property: "og:description", content: "Como o TaskFlow trata seus dados pessoais." },
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
        <h1 className="text-4xl font-bold">Política de privacidade</h1>
        <p className="text-sm text-muted-foreground">Atualizada em 1º de novembro de 2026.</p>
        <p>
          O TaskFlow guarda o que precisa para prestar o serviço: nome, e-mail, preferências da
          conta, tarefas (pessoais e de grupo), comentários, notificações e o histórico de grupos
          em que você entra. Se você entrar com Google, o provedor nos envia o e-mail e o nome da
          conta Google.
        </p>
        <p>
          Tarefas pessoais ficam só com a sua conta. Em um grupo, os membros veem as tarefas e os
          comentários daquele grupo. Não vendemos dados e não usamos rastreadores de publicidade.
        </p>
        <p>
          Você pode exportar uma cópia dos seus dados a qualquer momento. Ao excluir a conta,
          apagamos o perfil e as tarefas pessoais. Tarefas de grupo que você criou ou às quais
          ainda está ligado passam para um colega (ou o grupo é encerrado se você for o último
          membro). Comentários que você deixou em tarefas compartilhadas podem permanecer visíveis
          para quem ainda tem acesso à tarefa.
        </p>
        <p>
          Os dados ficam no projeto Supabase configurado para este aplicativo. Dúvidas: use a
          página Conta depois de entrar.
        </p>
      </main>
      <PublicFooter />
    </div>
  ),
});
