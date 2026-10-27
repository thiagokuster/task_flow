import { createFileRoute } from "@tanstack/react-router";
import { Logo, PublicFooter } from "@/components/brand";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Política de privacidade — TaskFlow" },
    { name: "description", content: "Como o TaskFlow coleta, usa e protege seus dados pessoais." },
    { property: "og:title", content: "Política de privacidade — TaskFlow" },
    { property: "og:description", content: "Como o TaskFlow trata seus dados pessoais." },
    { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <div className="min-h-screen"><header className="mx-auto max-w-3xl px-6 py-5"><Logo /></header>
      <main className="mx-auto max-w-3xl space-y-4 px-6 pb-16">
        <h1 className="text-4xl font-bold">Política de privacidade</h1>
        <p>Coletamos apenas nome, e-mail e os dados das tarefas que você cria, para prestar o serviço. Não vendemos dados nem usamos rastreadores de publicidade.</p>
        <p>Seus dados ficam isolados por conta no banco de dados. Você pode solicitar exportação ou exclusão da conta a qualquer momento. Ao excluir a conta, todos os dados associados são apagados.</p>
        <p>Este texto é um modelo e deve ser revisado juridicamente antes da publicação (LGPD).</p>
      </main><PublicFooter /></div>
  ),
});
