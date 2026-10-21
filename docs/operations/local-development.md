# Local development

_Last reviewed: 2026-10-21_

This guide uses only commands and paths that exist in the repository. Shorter startup notes (pt-PT) are in [`apps/api/README.md`](../../apps/api/README.md).

> **Never commit real environment files.** Only the `*.example` templates are tracked. Never paste real keys into documentation, issues or chat.

## Prerequisites

| Tool | Version / notes |
|---|---|
| Node.js | Not pinned by the repository. The project is developed with Node 23; use a version supported by Next.js 16 [verify in the Next.js docs]. |
| pnpm | 10.19.0 (`packageManager` in the root `package.json`) |
| Docker | Required by the Supabase CLI |
| Supabase CLI | Installed globally (e.g. `brew install supabase/tap/supabase`). The project currently runs 2.75.0. |
| npm | For the export Worker, which has its own `package-lock.json` and `wrangler` dev dependency |
| Deno | Optional (editor support only); Edge Functions run inside the Supabase CLI's Docker runtime |

## Repository layout for local work

| Directory | Run commands here for |
|---|---|
| `apps/web` | Frontend (`pnpm …`) — has its own lockfile and `node_modules` |
| `apps/api` | Supabase CLI (`supabase …`) |
| `apps/api/cloudflare-workers/export-documents-worker` | Worker (`npm …`) |

The root `package.json` scripts (`dev:web`, `build:web`, `lint:web`) are unverified because the root has no `node_modules`.

## First-time setup

```bash
# Frontend dependencies (from apps/web)
pnpm install
```

```bash
# Worker dependencies (from apps/api/cloudflare-workers/export-documents-worker)
npm install
```

Then create the environment files from the templates (next section) and start the services.

## Environment files

Each service reads exactly one local file with real values. All of them are ignored by Git; each has a tracked template with names and placeholders only.

| Service | Real file (ignored) | Template (tracked) | Read by |
|---|---|---|---|
| Frontend | `apps/web/.env.local` | `apps/web/.env.local.example` | `next dev` / `next build` |
| Supabase Auth (Google OAuth via `env()` in `config.toml`) | `apps/api/supabase/.env` | `apps/api/supabase/.env.example` | `supabase start` |
| Edge Functions | `apps/api/supabase/functions/.env` | `apps/api/supabase/functions/.env.example` | `supabase functions serve --env-file supabase/functions/.env` |
| Export Worker | `…/export-documents-worker/.dev.vars` | `…/export-documents-worker/.env.example` | `wrangler dev` (overrides `[env.development.vars]` in `wrangler.toml`) |

Where values come from:

- Local Supabase URL, anon key, service-role/secret key and S3 access keys: `supabase status` (from `apps/api`).
- `EXPORT_JWT_SECRET`: any long random string, **identical** in `functions/.env` and the Worker's `.dev.vars`.
- `OPENAI_API_KEY`: your OpenAI key (only needed for AI features).
- Google OAuth: see [Google OAuth](#google-oauth).

Rules worth knowing:

- In `functions/.env`, the CLI **ignores names starting with `SUPABASE_`** (it warns "Env name cannot start with SUPABASE_, skipping") and injects `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` itself. That is why the code uses `VC_SUPABASE_URL` / `VC_SUPABASE_ANON_KEY`.
- `NEXT_PUBLIC_*` values are compiled into the frontend; restart `pnpm dev` after changing them.
- Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_WORKER_URL` may be used by the frontend. Never put service-role keys or storage credentials in `apps/web`.

## Starting the stack

Use four terminals.

```bash
# 1. Supabase (from apps/api)
supabase start
```

```bash
# 2. Edge Functions (from apps/api) — always pass the functions env file
supabase functions serve --env-file supabase/functions/.env
```

```bash
# 3. Export Worker (from apps/api/cloudflare-workers/export-documents-worker)
npm run dev
```

```bash
# 4. Frontend (from apps/web)
pnpm dev
```

| URL | Service |
|---|---|
| http://localhost:3000 | Frontend (**use `localhost`, not `127.0.0.1`**, so auth redirects match the Site URL) |
| http://127.0.0.1:54321 | Supabase API gateway (REST, Auth, Storage, `/functions/v1/*`) |
| http://127.0.0.1:54323 | Supabase Studio |
| http://127.0.0.1:54324 | Inbucket (captured emails) |
| 127.0.0.1:54322 | Postgres |
| http://127.0.0.1:8787 | Export Worker (`wrangler dev`) |

## Restarting vs resetting Supabase

| Command | Effect | Data |
|---|---|---|
| `supabase stop` then `supabase start` | Restarts containers; re-reads `config.toml`, `supabase/.env` and email templates | **Kept** (Docker volumes) |
| `supabase status` | Shows URLs and local keys | Read-only |
| `supabase migration list` | Shows which migrations are applied locally | Read-only |
| `supabase migration up` | Applies pending migrations to the local database | Changes schema — ask before running (see `CLAUDE.md`) |
| ⚠️ `supabase db reset` | **Destroys the local database** and replays all migrations | **All local data lost** |
| ⚠️ `supabase stop --no-backup` | Stops and **deletes the data volumes** | **All local data lost** |

`supabase db reset` is **not** a troubleshooting step. Use it only when you intentionally want a clean database (for example, to prove the full migration chain replays from scratch) and after confirming you can lose local test data.

Changes to `config.toml`, `supabase/.env` or `supabase/templates/*` require `supabase stop` + `supabase start`. Edge Function code reloads automatically under `functions serve`; changes to `functions/.env` require restarting `functions serve`.

## Local email testing (Inbucket)

Local Auth sends every email to Inbucket at http://127.0.0.1:54324 (`[inbucket]` in `config.toml`).

- Email confirmation is **enabled** locally (`[auth.email] enable_confirmations = true`): new email/password accounts must click the confirmation link before logging in.
- Templates are the branded pt-PT files in `apps/api/supabase/templates/` (confirmation, recovery, email change), wired in `config.toml`.
- Rate limits apply to repeated sends to the same address; wait before re-requesting.

## Google OAuth

Local Google sign-in needs your **own** Google Cloud OAuth client; Supabase does not provide shared credentials.

1. Google Cloud Console → create (or reuse) a project → OAuth consent screen (External; scopes `openid`, `email`, `profile`; add your Google account as a test user while in Testing).
2. Credentials → OAuth client ID → **Web application**:
   - Authorised JavaScript origin: `http://localhost:3000`
   - Authorised redirect URI: `http://127.0.0.1:54321/auth/v1/callback`
3. Copy `apps/api/supabase/.env.example` to `apps/api/supabase/.env` and fill in `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`.
4. Restart Supabase (`supabase stop`, `supabase start`).

`config.toml` already enables Google and sets `redirect_uri`; it should not need changes.

## Edge Functions

- Source: `apps/api/supabase/functions/<name>/index.ts`; shared helpers in `functions/_shared/`.
- Called from the browser at `<NEXT_PUBLIC_SUPABASE_URL>/functions/v1/<name>`.
- `config.toml` sets `verify_jwt = false` for `r2-sign-upload`, `r2-sign-download`, `r2-confirm-upload` and `cleanup-pending-uploads`; these authenticate in code. All other functions keep the gateway JWT check.
- Logs appear in the `functions serve` terminal. Functions never log tokens or presigned URLs.

## Export Worker

- `npm run dev` runs `wrangler dev --env development` on port 8787.
- With `STORAGE_PROVIDER=s3` it reads objects from local Supabase Storage using the `S3_*` values in `.dev.vars` (same values as the Edge Functions, but with the host-side endpoint `http://127.0.0.1:54321/storage/v1/s3`).
- The Worker's own `README.md` still describes a MinIO setup on port 9000; that is outdated for this project.

## Quality checks

From `apps/web`:

```bash
pnpm exec tsc --noEmit --incremental false
```

```bash
pnpm lint
```

```bash
pnpm build
```

There are no automated tests. TypeScript currently reports 0 errors; ESLint reports pre-existing errors in files not yet cleaned up — do not add new ones.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Google sign-in: `Error 401: invalid_client` / "The OAuth client was not found" | `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` were not set when Supabase started; Auth received the literal `env(...)` text | Fill `apps/api/supabase/.env`, then `supabase stop` + `supabase start` |
| Google sign-in: access blocked for some accounts | Consent screen in Testing and the account is not a test user | Add the account as a test user |
| Edge Function error `Missing env: VC_SUPABASE_ANON_KEY` (or other `Missing env`) | `functions serve` started with the wrong `--env-file` | Restart with `--env-file supabase/functions/.env` |
| Startup warning `Env name cannot start with SUPABASE_, skipping` | A `SUPABASE_*` name in `functions/.env` | Harmless; the CLI injects those values. Remove the line to silence it |
| Storage request from a function fails with `ECONNREFUSED 127.0.0.1:54321` | Functions run in Docker; `127.0.0.1` is the container | Server-side requests must use `S3_INTERNAL_ENDPOINT_URL` (`http://kong:8000/storage/v1/s3`) |
| Server-side storage request returns 403 `SignatureDoesNotMatch` | Local Kong forwards `X-Forwarded-Port: 54321`; Storage rebuilds the signed host from forwarded headers | Sign for the host Storage reconstructs (implemented in `delete-document`); see [data and storage](../architecture/data-and-storage.md#document-deletion) |
| A function returns 401 although the user is signed in | Gateway JWT check rejects the user token in `Authorization` | Use the anon key in `Authorization` + user token in `x-user-jwt` (as the export and delete calls do), and inspect the response body (`{"msg": ...}` comes from the gateway, `{"error":"UNAUTHORIZED"}` from `requireUser`) |
| ZIP export returns `NO_FILES` | The project has no `document_files` with status `uploaded` (documents without files, or files tombstoned by an unfinished delete) | Upload a file; retry deleting half-deleted documents |
| Confirmation/recovery link lands on the welcome page instead of the expected page | App opened on `127.0.0.1:3000`; redirect not allowed, Supabase fell back to the Site URL | Use `http://localhost:3000` |
| Reset-password page says the link is invalid after refresh | The recovery event fires only once | Request a new link |
| A route hangs with "Rendering…" in development, server idle | Stuck dev-server compilation (seen after long sessions with many edits) | Restart `pnpm dev`; if it persists, stop it, delete `apps/web/.next/dev`, start again; consider disabling editor extensions that hook into Turbopack (e.g. Console Ninja) |
| Changes to `config.toml` or email templates have no effect | Supabase reads them only at start | `supabase stop` + `supabase start` |
