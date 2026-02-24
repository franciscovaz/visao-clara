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

## Variáveis de Ambiente

Copiar `.env.example` para `.env` e preencher valores reais.

## Deploy

```bash
# Deploy functions
supabase functions deploy

# Deploy migrações (link projeto primeiro)
supabase link --project-ref <ref>
supabase db push
```
