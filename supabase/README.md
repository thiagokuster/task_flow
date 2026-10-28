# Migrations Supabase

Esta pasta é a **fonte da verdade** das policies RLS, grupos e funções RPC.

Num banco **novo**, rode antes o bootstrap em `drizzle/migrations/`:

1. `0000_migration.sql`
2. `0001_profiles_insert.sql`

Só então aplique **cada** arquivo desta pasta no SQL Editor, na ordem do timestamp do nome, sem pular. A exclusão de conta depende de `20261027210000` antes de `20261028160000` — o arquivo de 16:00 não recria o trigger `force_owner`.

Depois de atualizar o repositório, rode os arquivos cujo timestamp ainda não estiver no banco, na mesma ordem.
