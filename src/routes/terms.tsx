import { createFileRoute } from "@tanstack/react-router";
import { Logo, PublicFooter } from "@/components/brand";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "Termos de uso — TaskFlow" },
    { name: "description", content: "Regras de uso do TaskFlow." },
    { property: "og:title", content: "Termos de uso — TaskFlow" },
    { property: "og:description", content: "Regras de uso do TaskFlow." },
    { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <div className="min-h-screen"><header className="mx-auto max-w-3xl px-6 py-5"><Logo /></header>
      <main className="mx-auto max-w-3xl space-y-4 px-6 pb-16">
        <h1 className="text-4xl font-bold">Termos de uso</h1>
        <p>O TaskFlow é oferecido para organização pessoal e profissional de tarefas. Você é responsável pelo conteúdo que cria e por manter sua senha segura. Contas usadas para abuso podem ser suspensas.</p>
        <p>Este texto é um modelo e deve ser revisado juridicamente antes da publicação (LGPD).</p>
      </main><PublicFooter /></div>
  ),
});
