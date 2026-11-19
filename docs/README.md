# Visão Clara — Technical Documentation

_Last reviewed: 2026-11-19_

Visão Clara is a multi-tenant SaaS for managing construction and renovation projects, initially for the Portuguese market. This folder is the long-term technical reference for the project.

## Documents

| Document | Read it when you need to… |
|---|---|
| [Architecture: system overview](architecture/system-overview.md) | Understand the components, how they talk to each other, and the known limitations. |
| [Architecture: authentication](architecture/authentication.md) | Work on sign-up, login, Google OAuth, password recovery, onboarding or redirects. |
| [Architecture: data and storage](architecture/data-and-storage.md) | Work on the database, tenancy, RLS, plans/quotas, document upload/deletion or ZIP export. |
| [Operations: local development](operations/local-development.md) | Set up and run the stack on a laptop, and troubleshoot local problems. |
| [Operations: production setup](operations/production-setup.md) | Prepare the first production environment (private beta): production URLs, launch blockers, ordered checklist. |
| [Decisions (ADRs)](decisions/README.md) | Understand or record why an architectural or provider decision was made. |

Related documentation elsewhere in the repository:

- [`CLAUDE.md`](../CLAUDE.md) — coding conventions and safety rules for contributors and AI assistants.
- [`apps/api/README.md`](../apps/api/README.md) — local startup commands and environment file locations (pt-PT).
- [`apps/web/docs/billing-and-plans.md`](../apps/web/docs/billing-and-plans.md) — frontend plan/entitlement model (see the note on server-side quotas in [data and storage](architecture/data-and-storage.md#plans-and-ai-quotas)).

## Status vocabulary

Every document uses the same labels so readers can tell facts from plans:

| Label | Meaning |
|---|---|
| **Verified** | Implemented in code **and** manually validated in the local environment (as reported by the project owner). |
| **Implemented** | Present in the code, but manual validation has not been confirmed. |
| **Planned** | Decided or intended, not configured yet. |
| **Unknown** | Cannot be determined from the repository; requires confirmation. |

Nothing in these documents describes a production deployment as existing: as of the review date **no production environment has been configured**. The DEV cloud environment (Supabase `visao-clara-dev`, R2 bucket `visao-clara-docs-dev`, Worker `export-documents-worker-staging`) is deployed and was validated by the owner on 2026-11-18. The production Supabase project `visao-clara-prod` exists but is paused and empty of functions and secrets. The production domain `visaoclara.pt` is registered with one.com, and Netlify Free has been chosen for the frontend but not set up.

## Production decisions taken (2026-11-19)

- **Canonical origin** `https://www.visaoclara.pt`; the apex `visaoclara.pt` redirects to it ([ADR-0101 note](decisions/README.md#adr-0101-domain-registrar), [ADR-0102 verification note](decisions/0102-initial-hosting-strategy-netlify-free.md#verification-note-2026-11-19)).
- **DNS** stays at one.com with its nameservers.
- **Frontend hosting** Netlify Free, with manually controlled production deploys ([ADR-0102](decisions/0102-initial-hosting-strategy-netlify-free.md)).
- **Supabase PROD** on the Free plan for now, monitored manually by the owner ([ADR-0104](decisions/README.md#adr-0104-supabase-production-plan-free-initially)).
- DEV and PROD stay fully isolated.

All production URLs (Netlify, Supabase Auth, Google OAuth, R2 CORS, legal pages) are listed in one table: [production URL reference](operations/production-setup.md#production-url-reference).

## Unresolved questions and missing production decisions

This is the single list of open items; other documents link here instead of repeating it. The launch blockers themselves are tracked in [production setup, section 0](operations/production-setup.md#remaining-production-launch-blockers-from-the-2026-11-19-readiness-audit).

### Decisions not yet made

1. **Transactional email (SMTP) provider** — Resend and Brevo are candidates; neither is integrated. Blocks production sign-up ([ADR-0103](decisions/README.md#adr-0103-transactional-email-provider)).
2. **Mailbox for the domain** — `visaoclara.pt` publishes a null MX and receives no mail; the legal pages need a contact address.
3. **R2 PROD bucket jurisdiction** — EU recommended (as DEV); cannot be changed after the bucket is created.
4. **Legal content** — entity details and the 25 `[A CONFIRMAR: …]` items in the privacy and terms drafts need the owner or a legal adviser.
5. **Cloudflare Workers plan** — Workers Paid recommended for real exports; not recorded as an ADR yet.
6. **Netlify deploy-control setting** — deploy locking vs manual builds; check which avoids credits for unpublished builds.
7. **Plans of beta users** — exports require Pro; plans are set manually in the SQL Editor.

### Facts that require confirmation

1. Email confirmation, password recovery and Google sign-in have not been validated against a cloud project (they need SMTP and a cloud OAuth client).
2. Whether very large exports fit the Workers CPU limit of the chosen Cloudflare plan.
3. Whether one.com offers `ALIAS`/`ANAME` records for the apex (otherwise `A 75.2.60.5`).
4. Netlify's build-tool variable names for pinning Node and pnpm.
5. The original rationale for choosing Supabase, Cloudflare R2 and a Cloudflare Worker (see [ADRs](decisions/README.md)).

Answered since 2026-10-22: DEV has all 30 migrations; the full export works on DEV with `verify_jwt = false` on `get-project-expenses-xlsx`; the documents ZIP export was validated on DEV (2026-11-18).

### Known gaps to address before or during the beta

Summarised here; details live in the linked documents.

- Plan limits other than AI quotas and export (`activeProjects`, `documentsPerProject`) are UI-only. ([data and storage](architecture/data-and-storage.md#plans-and-ai-quotas))
- Abandoned uploads are not cleaned up automatically (`cleanup-pending-uploads` is not scheduled); to be scheduled before opening sign-ups widely ([`apps/api/README.md`](../apps/api/README.md)).
- No account deletion / data export for users (GDPR requests are manual). ([production setup](operations/production-setup.md#15-security-checks))
- No automatic database backups on the Supabase Free plan; manual dumps are an owner routine. ([production setup](operations/production-setup.md#14-backup-and-recovery))
- No CI and no frontend tests; backend logic has 129 Deno tests (2026-11-19).

Resolved since 2026-10-22: tenant members can no longer write `document_files` and every storage key is checked against the row's ids (S1, migration `20261106100000`); the 20 MB limit and content type are signed into the presigned URL (S2).
