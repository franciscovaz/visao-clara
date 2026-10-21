# Visão Clara - API Backend

Este diretório contém o backend da aplicação Visão Clara, utilizando Supabase (Postgres + Edge Functions).

## Instalação do Supabase CLI

```bash
# macOS (Homebrew)
brew install supabase/tap/supabase

# Ou ver: https://supabase.com/docs/guides/cli/getting-started
```

## Comandos Locais

```bash
# Iniciar Supabase local (inclui Postgres)
supabase start

# Parar Supabase local
supabase stop

# Resetar estado local (cuidado: apaga dados!)
supabase db reset

# Aplicar migrações pendentes
supabase migration up

# Nova migração
supabase migration new <nome>
```

## Estrutura

- `supabase/migrations/` — Migrações SQL (schema + RLS)
- `supabase/functions/` — Edge Functions (Deno)
  - `r2-sign-upload/` — Gera presigned URL para upload no R2
  - `r2-sign-download/` — Gera presigned URL para download do R2

> **Nota:** As Edge Functions usam Deno. Instala a extensão **Deno** no VSCode para melhor suporte de tipos.

## Arranque local (desenvolvimento)

Cada serviço corre num terminal próprio. Os comandos `supabase` correm a partir de `apps/api`.

```bash
# 1. Supabase (Postgres, Auth, Storage, Inbucket em http://127.0.0.1:54324)
supabase start

# 2. Edge Functions — indicar sempre o ficheiro de ambiente das functions
supabase functions serve --env-file supabase/functions/.env

# 3. Worker de exportação ZIP (a partir de apps/api/cloudflare-workers/export-documents-worker)
npm run dev

# 4. Frontend (a partir de apps/web)
pnpm dev
```

Alterações a `supabase/config.toml` ou a `supabase/.env` só têm efeito depois de `supabase stop` e `supabase start`.

## Variáveis de Ambiente

Cada serviço tem **um** ficheiro com valores reais (ignorado pelo Git) e um modelo `.env.example`
versionado, apenas com nomes e valores de exemplo. Para configurar, copie o modelo e preencha os valores.
Nunca faça commit dos ficheiros reais.

| Serviço | Ficheiro real (não versionado) | Modelo versionado | Lido por |
|---|---|---|---|
| Supabase Auth (Google OAuth, `env(...)` em `config.toml`) | `supabase/.env` | `supabase/.env.example` | `supabase start` |
| Edge Functions | `supabase/functions/.env` | `supabase/functions/.env.example` | `supabase functions serve --env-file supabase/functions/.env` |
| Worker de exportação | `cloudflare-workers/export-documents-worker/.dev.vars` | `cloudflare-workers/export-documents-worker/.env.example` | `wrangler dev` (`npm run dev`) |
| Frontend | `apps/web/.env.local` | `apps/web/.env.local.example` | `next dev` / `next build` |

Notas:

- `EXPORT_JWT_SECRET` tem de ser igual nas Edge Functions e no Worker.
- As chaves S3 locais e as chaves do Supabase local são mostradas por `supabase status`.
- Nas Edge Functions, o CLI ignora variáveis começadas por `SUPABASE_` e injeta `SUPABASE_URL`,
  `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` automaticamente; por isso o código usa o prefixo `VC_`.
- Em produção não se usam ficheiros: variáveis no Vercel (frontend), `supabase secrets set` (functions),
  dashboard do Supabase (Google OAuth, SMTP) e `wrangler secret put --env production` (Worker).

## Deploy

```bash
# Deploy functions
supabase functions deploy

# Deploy migrações (link projeto primeiro)
supabase link --project-ref <ref>
supabase db push
```

> **Nota:** Em dev local, estas functions têm `verify_jwt=false`; a validação é feita no código via `supabase.auth.getUser()`.
