# TaskFlow

Painel para criar, organizar e concluir tarefas pessoais ou em grupo. Os dados ficam isolados por conta no banco, com convite por link quando a tarefa é compartilhada.

## 🚀 Demo

[Link da aplicação](https://seu-projeto.vercel.app)

## 🛠️ Tecnologias

- TanStack Start (React 19 + Vite)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase (Auth, PostgreSQL, RLS e Realtime)
- Zod
- Vitest

## ✨ Funcionalidades

- Autenticação por e-mail/senha e Google
- Tarefas pessoais (criar, concluir, filtrar e excluir)
- Grupos compartilhados com convite por link
- Responsável, prazo (sem data no passado) e comentários
- Notificações ao atribuir uma tarefa
- Atualização em tempo real no painel
- Tema claro/escuro e interface responsiva
- Exportar ou excluir a conta (LGPD)
- Validação de formulários
- Isolamento dos dados com Row Level Security

## 📦 Como rodar localmente

```bash
git clone https://github.com/thiagokuster/task_flow.git
cd task_flow
npm install
npm run dev
```

Copie `.env.example` para `.env` e preencha as chaves do projeto Supabase. No SQL Editor, rode as migrations em `supabase/migrations` (na ordem dos arquivos). A aplicação sobe em `http://localhost:3000`.
