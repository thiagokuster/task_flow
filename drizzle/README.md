# Drizzle (bootstrap)

Estas duas migrations criam o schema inicial (`profiles`, `tasks`, `notifications` e o restante do painel pessoal). Num projeto novo, rode-as **antes** de `supabase/migrations/`:

1. `migrations/0000_migration.sql`
2. `migrations/0001_profiles_insert.sql`

Não gere arquivos novos com `drizzle-kit`. A partir daí, a fonte da verdade é `supabase/migrations/`.
