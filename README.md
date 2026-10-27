# TaskFlow

Painel para criar, organizar e concluir tarefas pessoais ou em grupo. Os dados ficam isolados por conta no banco, com convite por link quando a tarefa é compartilhada.

Licença: [MIT](./LICENSE).

## Demo

[Link da aplicação](https://seu-projeto.vercel.app)

## Tecnologias

- TanStack Start (React 19 + Vite)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase (Auth, PostgreSQL, RLS e Realtime)
- Zod
- Vitest
- Bun (gerenciador de pacotes e scripts)

## Funcionalidades

- Autenticação por e-mail/senha e Google
- Tarefas pessoais (criar, concluir, filtrar e excluir)
- Grupos compartilhados com convite por link (código de 32 caracteres, validade de 7 dias, renovável)
- Responsável, prazo (sem data no passado, também no banco) e comentários
- Notificações ao atribuir uma tarefa
- Atualização em tempo real no painel
- Tema claro/escuro e interface responsiva
- Exportar ou excluir a conta (LGPD)
- Validação de formulários
- Isolamento dos dados com Row Level Security

## Como rodar localmente

Este repositório usa **Bun**. O lockfile é `bun.lock`.

```bash
git clone https://github.com/thiagokuster/task_flow.git
cd task_flow
bun install
bun run dev
```

Copie `.env.example` para `.env` e preencha as chaves do projeto Supabase. A aplicação sobe em `http://localhost:3000`.

Scripts úteis: `bun run test`, `bun run lint`, `bun run typecheck`.

No dashboard do Supabase, em Authentication → URL Configuration, inclua:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/callback` (e a URL de produção equivalente)

## Schema do banco

Num projeto **novo**, rode no SQL Editor nesta ordem:

1. `drizzle/migrations/0000_migration.sql` — tabelas base (`profiles`, `tasks`, `notifications`, RLS inicial)
2. `drizzle/migrations/0001_profiles_insert.sql` — INSERT no próprio perfil
3. Depois todos os arquivos de `supabase/migrations/`, na ordem do timestamp do nome

A fonte da verdade das policies, grupos e RPCs a partir daí é **`supabase/migrations/`**. Sempre aplique o arquivo mais recente depois de puxar o repositório.

Não gere migrations novas com Drizzle. A pasta `drizzle/` é só o bootstrap; mudanças novas entram em `supabase/migrations/`.

## CI

O GitHub Actions (`.github/workflows/ci.yml`) instala com Bun e roda typecheck, lint e testes a cada push e pull request.
