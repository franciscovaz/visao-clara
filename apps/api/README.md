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
pnpm dev:local      # Supabase Docker; `pnpm dev:cloud` usa o projeto visao-clara-dev
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
| Frontend (LOCAL) | `apps/web/.env.supabase-local` | `apps/web/.env.supabase-local.example` | `pnpm dev:local` |
| Frontend (DEV cloud) | `apps/web/.env.supabase-dev` | `apps/web/.env.supabase-dev.example` | `pnpm dev:cloud` |

Notas:

- `EXPORT_JWT_SECRET` tem de ser igual nas Edge Functions e no Worker.
- As chaves S3 locais e as chaves do Supabase local são mostradas por `supabase status`.
- Nas Edge Functions, o CLI ignora variáveis começadas por `SUPABASE_` e injeta `SUPABASE_URL`,
  `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` automaticamente; por isso o código usa o prefixo `VC_`.
- Em produção não se usam ficheiros: variáveis no Netlify (frontend), `supabase secrets set` (functions),
  dashboard do Supabase (Google OAuth, SMTP) e `wrangler secret put --env production` (Worker).

## Segurança do armazenamento de documentos

Todos os tenants partilham o mesmo bucket, por isso a chave do objeto é o único isolamento. As functions
`r2-sign-download`, `r2-confirm-upload`, `delete-document` e o Worker de exportação só aceitam uma chave
`<tenant>/<projeto>/<documento>/<ficheiro>/<nome>` construída com os identificadores da própria linha de
`document_files`, no bucket configurado no servidor (`_shared/storage_identity.ts`). Qualquer incoerência
devolve `409 STORAGE_LOCATION_UNTRUSTED`.

- `r2-sign-upload` verifica que o projeto pertence ao tenant indicado (404 caso contrário).
- A migração `20261106100000_harden_document_files_storage.sql` retira aos clientes o INSERT/UPDATE em
  `document_files`; as functions escrevem com o service role depois de verificar o utilizador. **A migração e as
  functions têm de ser aplicadas em conjunto** (não existe ordem em que ambas as versões funcionem).
- `cleanup-pending-uploads` (alteração de API): `project_id` é obrigatório; só afeta os uploads pendentes do
  próprio utilizador nesse projeto; `older_than_hours` tem mínimo 1 e máximo 2160 (por omissão 24).
- Testes: `deno test _shared/` em `supabase/functions`.

## Lockfile do Deno

As Edge Functions **não usam `deno.lock`**: `supabase/functions/deno.json` define `"lock": false` e o ficheiro
está no `.gitignore`. O Edge Runtime local (Deno 2.1.4) não lê lockfiles versão 5, que são os criados
por versões recentes do Deno (2.9.x) ao correr `deno test`, e o seu arranque falha com
`Unsupported lockfile version '5'`.

Contrapartida: sem lockfile não há verificação de integridade das dependências remotas. A reprodutibilidade
depende de os imports estarem fixados por versão no URL (ex.: `https://esm.sh/@supabase/supabase-js@2.39.7`),
por isso **não use imports sem versão**. Para voltar a usar um lockfile, gere-o com uma versão do Deno
compatível com o Edge Runtime, como alteração própria (idealmente junto com a atualização do Supabase CLI).

## Deploy

```bash
# Deploy functions
supabase functions deploy

# Deploy migrações (link projeto primeiro)
supabase link --project-ref <ref>
supabase db push
```

> **Nota:** Em dev local, estas functions têm `verify_jwt=false`; a validação é feita no código via `supabase.auth.getUser()`.
