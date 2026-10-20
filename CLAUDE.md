# CLAUDE.md — Visão Clara

Guidance for Claude Code sessions in this repository. Keep it accurate: when you change an
architectural pattern described here, update this file in the same change.

## 1. Project overview

Visão Clara is a multi-tenant SaaS for managing construction and renovation projects
(Portuguese market). Per project, users manage a checklist of tasks by phase, expenses,
documents (file uploads), "responsáveis de obra" (contractors/contacts), exports (Excel, ZIP)
and AI features (checklist suggestions, chat assistant) with plan-based monthly quotas.

## 2. Repository structure

```
apps/
  web/                         Next.js frontend (has its own pnpm-lock.yaml + pnpm-workspace.yaml)
    app/                       App Router routes (all pages are client components)
      [projectId]/             Project-scoped routes; layout.tsx loads project data
      <page>/page.tsx          Page implementations (documents, expenses, checklist, …)
      login, register, auth/callback, onboarding/step1..5
    components/                Feature components and modals (AppLayout, Add*/Edit* modals, …)
    components/ui/             Shared primitives: Button, Card, Input, EmptyState, ProgressBar
    lib/supabase/client.ts     The single browser Supabase client (anon key)
    lib/api/edge-client.ts     invokeEdgeFunction helper (currently unused, has type errors)
    lib/utils.ts               cn() = clsx + tailwind-merge
    src/store/                 Zustand stores (projectStore, authStore, appContextStore)
    src/components/providers/  AuthProvider, DataProvider (mounted in app/layout.tsx)
    src/services/              ProfileService (profile, tenant/onboarding bootstrap)
    src/mocks/                 Domain TYPES (Task, Expense, Document, …) + legacy mock data
    src/utils/dateUtils.ts     Date formatting/sorting helpers
    docs/billing-and-plans.md  Plans & entitlements model
  api/
    supabase/
      config.toml              Local Supabase config (ports 54321 API, 54322 DB, 54323 Studio)
      migrations/              SQL migrations (schema + RLS)
      functions/               Deno Edge Functions; shared code in functions/_shared/
    cloudflare-workers/export-documents-worker/   Streams project documents as a ZIP (npm + wrangler)
packages/                      Empty (no shared packages yet)
```

## 3. Technology stack

- **Frontend:** Next.js 16.1.1 (App Router), React 19.2.3, TypeScript 5 (`strict`), Tailwind CSS v4
  (via `@tailwindcss/postcss`), Zustand 5, `@supabase/supabase-js` 2, icons from `lucide-react`
  and `react-icons`. No form or validation library, no data-fetching library (no React Query/SWR).
- **Backend:** Supabase (Postgres + RLS, Auth with email/password and Google OAuth, Edge Functions on
  Deno importing `supabase-js@2.39.7` from esm.sh).
- **Storage:** S3-compatible object storage — Cloudflare R2 in production, local S3 (Supabase Storage
  or MinIO) in development, selected by `FILE_STORAGE_PROVIDER` (`local_s3` | `r2`).
- **AI:** OpenAI Chat Completions (`OPENAI_API_KEY`, `OPENAI_MODEL`, default `gpt-4o-mini`), called only
  from Edge Functions.
- **Package manager:** pnpm 10 (`packageManager: pnpm@10.19.0`). The worker uses npm (`package-lock.json`).

## 4. Frontend architecture and conventions

- **Routing.** Project pages live at `/<projectId>/<page>`. Most `app/[projectId]/<page>/page.tsx`
  files are 7-line wrappers that render the implementation from `app/<page>/page.tsx` — edit the
  implementation, not the wrapper. Exception: `app/[projectId]/dashboard/page.tsx` is its own
  implementation; `app/dashboard/page.tsx` is a separate, older dashboard used around onboarding.
  `/<projectId>` redirects to `/<projectId>/dashboard`.
- **Navigation.** `components/AppLayout.tsx` provides sidebar (desktop), header + drawer and bottom
  nav (mobile) and builds URLs from `params.projectId` → store `activeProjectId` → first project.
  Pages wrap their content in `<AppLayout currentPage="…">`.
- **Active project.** The route `projectId` is the source of truth. `app/[projectId]/layout.tsx` and
  `AppLayout` sync it into `useProjectStore().activeProjectId`. `appContextStore` also has an
  `activeProjectId`/`activeTenantId`, used only by onboarding/login flows — do not use it for
  project pages. Switching project happens in `components/ProjectDropdown.tsx` via `router.replace`.
- **Client components.** Every page and provider is `'use client'`; there are no Server Components,
  Server Actions, route handlers or `middleware.ts`.
- **Imports.** Path alias `@/*` → `apps/web/*` (e.g. `@/components/...`, `@/src/store/...`,
  `@/lib/supabase/client`). Some files still use relative paths; prefer `@/` in new code.
- **Types.** Domain types are exported from `src/mocks/*` (e.g. `Task`, `TaskPhaseDB`,
  `PHASE_LABELS`, `Expense`, `Document`, `Responsible`, `UserProfile`). Mock *data* is legacy; stores
  start empty and are filled from Supabase. Do not reintroduce mock data into real flows.
- **DB ↔ UI mapping.** Supabase rows are snake_case and are mapped inline to camelCase UI models
  (e.g. `amount_cents / 100` → `amount`, `doc.title` → `name`, `issued_on` → pt-PT date string).
  The same mapping is currently duplicated in several files (DataProvider, `[projectId]/layout.tsx`,
  `[projectId]/dashboard`, documents page). When changing a mapping, find and update every copy
  (`grep -rn "amount_cents\|doc_type" apps/web`), or extract a shared mapper if the task allows.

## 5. Backend architecture and conventions

### Migrations
- Location `apps/api/supabase/migrations/`, file name `YYYYMMDDHHMMSS_snake_case_description.sql`.
  Never edit an existing migration; add a new one.
- Tables use `uuid` PKs (`gen_random_uuid()`), `created_at timestamptz NOT NULL DEFAULT now()`,
  text columns with `CHECK (… IN (…))` instead of Postgres enums, and `public.set_updated_at()`
  triggers where `updated_at` exists. Money is stored as integer cents (`expenses.amount_cents`).
- Every tenant-scoped table carries `tenant_id` (and `project_id` where relevant). RLS is enabled on
  every table, with policies named `<table>_<select|insert|update|delete>_<scope>`, typically
  `USING (public.is_tenant_member(tenant_id))`. `is_tenant_member` is `SECURITY DEFINER` with
  `row_security = off` to avoid policy recursion (see `20250220020000_fix_rls_recursion.sql`).
- Insert policies also check `created_by IS NULL OR created_by = auth.uid()`; tasks additionally
  check the project belongs to the same tenant (`20260421250000_fix_task_phase_constraint.sql` holds
  the current task policies after several iterations).
- AI usage/chat tables (`ai_usage`, `ai_reservations`, `ai_chat_*`) are read-only to clients (`WITH
  CHECK (false)` on writes); mutations go through `SECURITY DEFINER` RPCs suffixed `_service`,
  granted only to `service_role`.
- Phase vocabularies differ: `tasks.phase` ∈ planning, design, licensing, construction, finishes,
  general, done (CHECK constraint); `projects.current_phase` is unconstrained `text`, and the UI maps
  design, licenses, construction, finishing, completed (anything else → "Planeamento"). Check the
  SQL and existing mappings before assuming a value.

### Edge Functions (`apps/api/supabase/functions/<kebab-name>/index.ts`)
Standard request flow — follow it for new functions:
1. Handle `OPTIONS` with CORS headers; reject unsupported methods with 405.
2. `const { userId, token } = await requireUser(req)` from `_shared/auth.ts` (accepts
   `x-user-jwt` or `Authorization: Bearer`; throws a 401 `Response`).
3. `createUserSupabaseClient(token)` from `_shared/supabase.ts` for all user-scoped reads, so RLS
   applies. Verify project access through this client (select the project by id; 404 if not found).
4. Validate inputs explicitly (required fields, types, sizes, MIME types) and return 400s.
5. Use a service-role client **only after** the user's access has been verified, and only for
   operations RLS intentionally blocks (quota RPCs, cross-row cleanup). The export flow
   (`authorize-project-documents-export` → worker / `get-project-expenses-xlsx`) uses a short-lived
   JWT signed with `EXPORT_JWT_SECRET` (issuer `visao-clara-edge`, audience `visao-clara-worker`,
   `scope`, `project_id`) instead of the user JWT.
- Env vars use the `VC_` prefix for Supabase URL/keys and R2 (`VC_SUPABASE_URL`,
  `VC_SUPABASE_ANON_KEY`, `VC_R2_*`), plus `SUPABASE_SERVICE_ROLE_KEY`, `S3_*`,
  `FILE_STORAGE_PROVIDER`, `OPENAI_*`, `EXPORT_JWT_SECRET`. See the `.env.example` files.
- Error responses are not uniform yet: newer helpers use `jsonError()` → `{ ok: false, error }`;
  other functions return `{ error: "UPPER_SNAKE_CODE", reason }`. Match the style of the function you
  are editing and keep status codes meaningful (400/401/403/404/409/429/500). The frontend branches on
  status codes (e.g. 429 = quota reached).
- `config.toml` sets `verify_jwt = false` for `r2-sign-upload`, `r2-sign-download`,
  `r2-confirm-upload` and `cleanup-pending-uploads`; they authenticate in code via `requireUser`.
  Any function with `verify_jwt = false` must call `requireUser` (or verify an export token) itself.
- Upload flow: `r2-sign-upload` (creates `document_files` row `status='pending'`, returns presigned
  PUT URL) → browser PUTs file → `r2-confirm-upload` (marks `uploaded`). Downloads via
  `r2-sign-download`. Allowed size ≤ 20 MB.
- AI quota flow: reserve (`reserve_ai*_service`) → call OpenAI → finalize, or release on failure.

## 6. Authentication, authorization and multi-tenancy

- Auth: Supabase Auth in the browser (`persistSession`, `autoRefreshToken`). `initializeAuth()` in
  `src/store/authStore.ts` hydrates `useAuthStore` (`user`, `session`, `initialized`) and subscribes
  to `onAuthStateChange`. Wait for `initialized === true` before deciding a user is logged out.
- There is **no route-level auth guard** (no middleware). Redirects to `/login` are done per page.
  Never rely on frontend checks for security — RLS and Edge Functions are the enforcement layer.
- Tenancy: `tenants` ← `tenant_members(tenant_id, user_id, role owner|admin|member)` ← `projects` ←
  project data. Onboarding (`ProfileService.createTenantStructure/completeOnboarding`) creates the
  tenant, the owner membership (bootstrap policy) and the first project. `DataProvider` currently
  loads projects for the user's **first** tenant membership only.
- Rules:
  - Always filter project data by `project_id` (and keep `tenant_id` set on inserts) — RLS restricts
    to the tenant, not to the project.
  - Never use the service-role key in `apps/web`; only `NEXT_PUBLIC_SUPABASE_URL`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_WORKER_URL` are allowed client-side.
  - Never weaken, drop or bypass RLS policies, or add `SECURITY DEFINER` functions callable by
    `authenticated`, without explicit approval and a stated reason.
  - Plan entitlements in `projectStore` (`can()`, `getLimit()`) are UI gating only; quotas are
    enforced server-side (AI usage RPCs). Do not move enforcement to the client.

## 7. State management and data fetching

- `useProjectStore` (`src/store/projectStore.ts`, `devtools` only, not persisted) holds `projects`,
  `activeProjectId`, per-project maps (`tasksByProjectId`, `expensesByProjectId`,
  `documentsByProjectId`, `responsiblesByProjectId`, `expenseCategoriesByProjectId`), `userProfile`
  and `billing`. Getters like `getTasksForProject(id)` return `[]` when nothing is loaded.
- `useAuthStore` is persisted to localStorage (`auth-store`). `useAppContextStore` holds onboarding
  data in memory.
- Who loads what today:
  - `DataProvider`: profile (`ProfileService.loadProfileAndSyncPlan`) and the active projects list.
  - `app/[projectId]/layout.tsx`: hydrates the current project if missing, then tasks, expenses,
    responsibles and documents for that project.
  - Some pages fetch again on their own (`[projectId]/dashboard`, documents page).
- The store has **no request-status fields**. The layout decides whether data is loaded by checking
  `length > 0`, which re-fetches empty collections and cannot tell "loading" from "empty". Pages
  that read from the store therefore cannot know when a request finished.
- Rules for new or changed data-loading code:
  - Model request lifecycle explicitly (`idle | loading | success | error`, per project where
    relevant). Never infer completion from an empty array, and never use timeouts/polling/arbitrary
    delays to hide loading-state problems.
  - Before adding a fetch, check whether the layout/provider already loads that data; avoid
    duplicate requests for the same project data.
  - Guard against stale responses when `projectId` changes (compare the id when the response
    arrives, or use an `ignore`/AbortController cleanup in the effect) so project A's data is never
    written into project B's view.
  - Always handle the Supabase `error` field — not just `data`.
  - Call Edge Functions the way existing pages do: `fetch(`${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/<name>`)`
    with `Authorization: Bearer ${session.access_token}` from `supabase.auth.getSession()`, and handle
    401/404/429 explicitly with pt-PT messages.

## 8. UI and UX conventions

- Preserve the existing UI unless a redesign is requested. Reuse `components/ui/*` (`Button` with
  `variant` primary|secondary and `size` sm|md|lg|full, `Card`, `Input`, `EmptyState`,
  `ProgressBar`) and existing modals before writing new markup. Compose classes with `cn()`.
- Styling is Tailwind utility classes inline; palette is slate/gray with blue accents, `rounded-lg`/
  `rounded-xl` cards. Icons: `lucide-react` (preferred in newer code) or `react-icons/hi`/`hi2`
  where the file already uses them — don't mix within one file.
- Responsive pattern: mobile-first, `md:` breakpoint switches between mobile header/bottom nav and the
  desktop sidebar; main content uses `p-4 md:p-6 pt-20 md:pt-6 pb-24 md:pb-6`. Keep layouts working
  on both.
- Every async view needs loading (spinner `animate-spin … border-b-2 border-blue-600` is the existing
  idiom), error, empty (`EmptyState`) and success states; disable submit buttons while submitting.
- Forms are controlled `useState` fields with manual validation and per-field pt-PT error messages;
  modals handle `Escape` and lock body scroll. Follow the same pattern; don't add a form library
  without approval.
- **All user-facing text is European Portuguese (pt-PT)**: "ficheiro" not "arquivo", "registo",
  "telemóvel", "equipa", "utilizador"; avoid Brazilian forms (e.g. "requisição", "você" phrasing).
  Format dates/numbers with the `pt-PT` locale and currency in EUR. Code, identifiers, comments and
  technical docs are in English.

## 9. Development commands

Run frontend commands from `apps/web` (it has its own lockfile and `node_modules`; the root has no
`node_modules`, so the root `pnpm dev:web` / `build:web` / `lint:web` scripts are unverified).

```bash
pnpm dev                                  # next dev on http://localhost:3000
pnpm lint                                 # eslint (next core-web-vitals + typescript)
pnpm exec tsc --noEmit --incremental false  # type check without touching tsbuildinfo
pnpm build                                # next build
```

Backend (from `apps/api`, Supabase CLI). Starting/stopping local services is fine; the others need
approval (see §12):

```bash
supabase start | supabase stop | supabase status
supabase functions serve                  # local Edge Functions
supabase migration new <name>             # creates an empty migration file
supabase migration up | supabase db reset | supabase db push | supabase functions deploy  # approval required
```

Worker (from `apps/api/cloudflare-workers/export-documents-worker`): `npm run dev`
(`wrangler dev --env development`); `npm run deploy` requires approval.

## 10. Testing and verification

- There are **no automated tests** and no CI in the repository. Verification = type check + lint +
  manual check in the running app.
- Baseline on 2026-10-20 (`main`): `tsc` reports 9 errors and `eslint` 33 errors / 79 warnings, all
  pre-existing. Don't add new ones; compare against the baseline for the files you touched and report
  results honestly (including checks you could not run).
- For data-loading changes, verify: first load, refresh on a deep link (`/<projectId>/<page>`),
  switching projects via the dropdown, a project with empty collections, and an error response.
- For backend changes, reason about RLS for a user of another tenant; when testing locally, use test
  accounts in the local Supabase only.

## 11. Git workflow

- Single long-lived branch `main` (remote `origin` on GitHub). Commit messages follow Conventional
  Commits with scopes, e.g. `feat(web): …`, `fix(api): …`, `feat(api-db): …`, `feat(functions): …`,
  `fix(worker): …`, `refactor: …`, `chore: …` — imperative, lower-case, English.
- Never commit, push, create branches/PRs or amend unless explicitly asked.
- The working tree often contains the user's uncommitted work: check `git status` first and never
  discard, stash, reset or overwrite it without approval.
- Some Supabase CLI artefacts are tracked (`apps/api/supabase/.branches`, `.temp`, `snippets/`);
  don't modify or delete them as part of unrelated work.

## 12. Safety rules — require explicit approval

Ask before:
- Running migrations against any database (`supabase migration up`, `db push`), `supabase db reset`,
  or any SQL that writes data or changes schema/policies.
- Deploying anything (`supabase functions deploy`, `wrangler deploy`, Vercel, etc.).
- Installing, removing or upgrading dependencies (pnpm/npm/brew/deno).
- Changing RLS policies, `SECURITY DEFINER` functions, grants, `verify_jwt` settings or auth config.
- Changing an Edge Function's request/response contract or a table's columns used by the frontend.
- Deleting files, large refactors, or changes outside the requested scope.
- Git operations that publish or rewrite history.

Always:
- Never read, print or commit `.env*`/`.dev.vars` values; refer to variables by name only.
- Keep the service-role key, OpenAI key, R2/S3 secrets and `EXPORT_JWT_SECRET` server-side.
- Investigate the root cause before fixing a bug and explain it in the summary.
- Keep changes focused; follow the patterns of the file you are editing rather than refactoring it.

## Known issues (verified 2026-10-20 — fix only when asked)

- `[projectId]/layout.tsx` uses `length > 0` as "already loaded" (see §7).
- `[projectId]/dashboard` redirects unauthenticated users to `/auth/signin`, which does not exist.
- Project type values are mapped inconsistently (`new_construction` vs `new-construction`).
- `app/layout.tsx` still has `lang="en"` and the default "Create Next App" metadata.
- `authStore` logs session details to the console.
- `lib/api/edge-client.ts` is unused and fails type checking.
