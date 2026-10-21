# Architecture Decision Records (ADRs)

_Last reviewed: 2026-10-21_

An ADR records **one** significant decision: what was decided, why, and what it costs. ADRs make it possible to revisit a decision later without re-deriving the reasoning.

## Process

1. Write an ADR when a decision is hard to reverse, affects several components, involves a paid provider, or changes a security boundary.
2. Copy the [template](#template) into this file (or, if this file grows too large, into `docs/decisions/NNNN-short-title.md` and link it from the index).
3. Start with **Status: Proposed**. Change it to **Accepted** when decided, **Superseded by ADR-XXXX** when replaced, or **Rejected**.
4. Never rewrite the history of an accepted ADR: supersede it with a new one.
5. **Do not invent rationale.** If the original reasons are unknown, write "Rationale requires confirmation" and list only what the repository shows.
6. Provider decisions must state why the selected option was chosen, at least one or two alternatives and why they were not selected, and pricing/operational trade-offs. Prices change: record the date and source, and re-check before committing.

Numbering: `0001–0099` existing architecture, `0100+` provider and production decisions.

## Template

```markdown
### ADR-NNNN: Title

- **Status:** Proposed | Accepted | Superseded by ADR-XXXX | Rejected
- **Date:** YYYY-MM-DD

**Context** — The problem and constraints.

**Decision** — What we do.

**Alternatives considered**
- Option A — why not selected.
- Option B — why not selected.

**Rationale** — Why this option wins (costs, operations, security, team skills).

**Consequences** — What becomes easier, harder, or must be done next.
```

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](#adr-0001-supabase-as-the-backend-platform) | Supabase as the backend platform | Accepted (rationale requires confirmation) |
| [0002](#adr-0002-s3-compatible-object-storage-cloudflare-r2-in-production) | S3-compatible object storage, Cloudflare R2 in production | Accepted (rationale requires confirmation) |
| [0003](#adr-0003-cloudflare-worker-for-document-zip-exports) | Cloudflare Worker for document ZIP exports | Accepted (rationale requires confirmation) |
| [0004](#adr-0004-protect-profilesplan-with-column-level-privileges) | Protect `profiles.plan` with column-level privileges | Accepted |
| [0005](#adr-0005-persist-onboarding-answers-in-browser-storage) | Persist onboarding answers in browser storage | Accepted |
| [0006](#adr-0006-detect-password-recovery-sessions-at-client-module-load) | Detect password-recovery sessions at client module load | Accepted |
| [0101](#adr-0101-domain-registrar) | Domain registrar | Proposed |
| [0102](#adr-0102-frontend-hosting) | Frontend hosting | Proposed |
| [0103](#adr-0103-transactional-email-provider) | Transactional email provider | Proposed |

---

## Accepted decisions

### ADR-0001: Supabase as the backend platform

- **Status:** Accepted — rationale requires confirmation
- **Date:** Unknown (first migration: 2025-02-19)

**Context** — The product needs a relational database, authentication (email/password and Google), multi-tenant authorization and server-side functions for secrets (storage signing, OpenAI).

**Decision** — Use Supabase: Postgres with RLS for data and tenancy, Supabase Auth, and Deno Edge Functions. The frontend talks to Supabase directly with the anon key; there is no separate API server.

**Alternatives considered** — Not documented. Requires confirmation (e.g. Firebase, a custom Node/Postgres API, Neon + Auth.js).

**Rationale** — Requires confirmation. Observable in the code: RLS is the primary authorization layer, and a client-only Next.js app relies on it.

**Consequences** — Security depends on correct RLS for every table; privileged work must be done in Edge Functions; local development requires Docker and the Supabase CLI; hosted plan choice determines backups and pausing.

### ADR-0002: S3-compatible object storage, Cloudflare R2 in production

- **Status:** Accepted — rationale requires confirmation
- **Date:** Unknown (storage provider columns added 2026-03-05)

**Context** — Documents (PDF/images, up to 20 MB) must be private, uploaded directly from the browser and exported in bulk.

**Decision** — Store files in S3-compatible storage selected by `FILE_STORAGE_PROVIDER`: Supabase Storage's S3 API locally (`local_s3`) and Cloudflare R2 in production (`r2`). Access only through presigned URLs issued by Edge Functions; `document_files` records the provider, bucket and key per file.

**Alternatives considered** — Not documented. Requires confirmation (e.g. Supabase Storage in production, AWS S3).

**Rationale** — Requires confirmation. R2 is commonly chosen for having no egress fees [verify], which matters for downloads and ZIP exports; the provider-neutral columns suggest portability was intended.

**Consequences** — Two storage configurations to maintain; production needs R2 bucket CORS and an API token; local signing has Docker networking specifics (see [data and storage](../architecture/data-and-storage.md#document-deletion)).

### ADR-0003: Cloudflare Worker for document ZIP exports

- **Status:** Accepted — rationale requires confirmation
- **Date:** Unknown

**Context** — Exporting all documents of a project can produce large archives.

**Decision** — A Cloudflare Worker streams the ZIP. An Edge Function authorizes the user and issues a 5-minute HS256 export JWT (`EXPORT_JWT_SECRET`); the Worker verifies it and reads file records with the service-role key.

**Alternatives considered** — Not documented. Requires confirmation (e.g. generating the ZIP in an Edge Function, client-side zipping).

**Rationale** — Requires confirmation. Observable: the Worker streams files (no full buffering) and uses an R2 binding in production.

**Consequences** — An extra deployable with its own secrets; the shared secret must match in two places; the full export depends on `get-project-expenses-xlsx` accepting the export token (currently blocked by `verify_jwt`, see [ZIP export](../architecture/data-and-storage.md#zip-export)).

### ADR-0004: Protect `profiles.plan` with column-level privileges

- **Status:** Accepted
- **Date:** 2026-10-21

**Context** — RLS on `profiles` restricts rows (`id = auth.uid()`), not columns. Any signed-in user could set their own `plan` to `premium`, raising AI quotas and unlocking exports. Plans are assigned manually during the beta.

**Decision** — Migration `20261021120000_protect_profiles_plan.sql` revokes table-wide `INSERT`/`UPDATE` from `anon`/`authenticated` and grants them only on the editable columns (`id, full_name, avatar_url, first_name, last_name, phone, city, country, onboarding_completed_at`).

**Alternatives considered**
- `BEFORE INSERT/UPDATE` trigger rejecting plan changes from client roles — more code, depends on detecting the caller's role, still needs care for the SQL Editor.
- Moving `plan` to a separate table writable only by the service role — larger change to the schema, quotas and frontend.

**Rationale** — Smallest declarative change; enforced by Postgres before RLS; fails closed; the SQL Editor (owner) and service role keep full access.

**Consequences** — Any new client-editable profile column must be added to the grants in a new migration, otherwise writes fail with `42501`.

### ADR-0005: Persist onboarding answers in browser storage

- **Status:** Accepted
- **Date:** 2026-10-21

**Context** — Users answer onboarding questions before having an account. Google OAuth and email confirmation are full-page redirects, which wiped the in-memory answers.

**Decision** — Persist only `pendingOnboardingData` and a timestamp in `localStorage` (`vc-pending-onboarding`, Zustand `persist`). `ProfileService.resumePendingOnboarding()` applies them once the user is authenticated, skips users who already belong to a tenant, discards answers older than 7 days, and clears them after success.

**Alternatives considered**
- Database table for anonymous onboarding answers — needs an anonymous write path and cleanup; more surface for abuse.
- `sessionStorage` — lost when the confirmation link opens in a new tab.

**Rationale** — Minimal change, no new backend surface, no tokens or identifiers stored.

**Consequences** — Answers do not follow the user to another device (they redo onboarding); duplicate prevention is application-level, not a database constraint (see [authentication](../architecture/authentication.md#duplicate-prevention-what-the-code-guarantees)).

### ADR-0006: Detect password-recovery sessions at client module load

- **Status:** Accepted
- **Date:** 2026-10-21

**Context** — A recovery link creates a normal Supabase session. The reset form must only be available to sessions created by a recovery link. auth-js emits `PASSWORD_RECOVERY` once, from a `setTimeout` during client initialization, so a page-level listener can miss it.

**Decision** — `lib/supabase/client.ts` reads the URL flags and subscribes to `onAuthStateChange` when the module loads, keeping a small recovery state (`none | pending | ready(userId) | invalid`) that the reset page reads with `useSyncExternalStore`.

**Alternatives considered**
- Allow any session to change its password on the reset page — a normal session would grant access to the form.
- Decoding the access token's `amr` claim — depends on undocumented token contents.
- Switching to the PKCE flow — larger change affecting all auth flows.

**Rationale** — Uses the documented Supabase event; deterministic with the installed auth-js version; no extra dependencies.

**Consequences** — Refreshing the reset page invalidates it (a new link is needed); revisit if the auth flow moves to PKCE.

---

## Pending decisions

### ADR-0101: Domain registrar

- **Status:** Proposed
- **Date:** —

**Context** — The product needs a domain for the app, Auth redirects and email sending. Candidate: `visaoclara.pt` through **Dominios.pt** (not purchased).

**Decision** — TODO.

**Alternatives to evaluate**
- Dominios.pt — Portuguese registrar; pricing and DNS features to confirm.
- Another DNS.PT-accredited registrar — compare price, renewal price, DNS management and support.
- A `.com` domain at a registrar such as Cloudflare Registrar (at-cost pricing [verify]) — check whether `.pt` is supported there [verify].

**Trade-offs to record** — First-year vs renewal price; whether DNS can be managed at the registrar or delegated; `.pt` holder requirements; transfer lock and auto-renew.

### ADR-0102: Frontend hosting

- **Status:** Proposed
- **Date:** —

**Context** — `apps/web` is a Next.js 16 app whose pages are all client components; it needs Node-based hosting for dynamic routes (`/[projectId]/…`) and three `NEXT_PUBLIC_*` variables at build time. The repository contains no hosting configuration.

**Decision** — TODO.

**Alternatives to evaluate**
- Vercel — native Next.js support; the free Hobby tier is limited to non-commercial use, paid plans are per seat [verify current terms and prices].
- Cloudflare (Workers with the OpenNext adapter) — same vendor as R2 and the Worker; extra adapter configuration; Next.js 16 compatibility to confirm.
- Netlify or similar — Next.js runtime support and limits to confirm.

**Trade-offs to record** — Cost at beta scale and after paid launch, preview deployment protection, custom-domain and HTTPS handling, rollback mechanism, logs.

### ADR-0103: Transactional email provider

- **Status:** Proposed
- **Date:** —

**Context** — Supabase Auth needs custom SMTP in production for confirmation, recovery and email-change messages. Volume during the beta is very low.

**Decision** — TODO. Candidates: **Resend**, **Brevo** (neither integrated).

**Alternatives to evaluate**
- Resend — developer-focused, SMTP available; free-tier limits [verify].
- Brevo — EU-based provider with SMTP relay; free-tier daily limits [verify].
- Postmark or Amazon SES — strong deliverability (Postmark) or low cost at scale (SES) with more setup.

**Trade-offs to record** — Free-tier limits, EU data processing (GDPR), domain verification effort (SPF/DKIM/DMARC), deliverability, upgrade cost.

### Related decisions not yet recorded

- **Supabase production plan and region** (affects backups, pausing, cost) — create an ADR when decided.
- **Cloudflare plan for R2 and Workers** (Workers CPU limits for large ZIPs, R2 storage costs) — create an ADR when decided.
