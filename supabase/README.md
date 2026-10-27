# Migrations Supabase

Esta pasta é a **fonte da verdade** das policies RLS, grupos e funções RPC.

Num banco **novo**, rode antes o bootstrap em `drizzle/migrations/`:

1. `0000_migration.sql`
2. `0001_profiles_insert.sql`

Só então aplique os arquivos desta pasta, na ordem do timestamp do nome. Depois de atualizar o repositório, rode qualquer arquivo novo que ainda não estiver no banco.
