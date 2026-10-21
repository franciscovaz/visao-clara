# Visão Clara — Technical Documentation

_Last reviewed: 2026-10-21_

Visão Clara is a multi-tenant SaaS for managing construction and renovation projects, initially for the Portuguese market. This folder is the long-term technical reference for the project.

## Documents

| Document | Read it when you need to… |
|---|---|
| [Architecture: system overview](architecture/system-overview.md) | Understand the components, how they talk to each other, and the known limitations. |
| [Architecture: authentication](architecture/authentication.md) | Work on sign-up, login, Google OAuth, password recovery, onboarding or redirects. |
| [Architecture: data and storage](architecture/data-and-storage.md) | Work on the database, tenancy, RLS, plans/quotas, document upload/deletion or ZIP export. |
| [Operations: local development](operations/local-development.md) | Set up and run the stack on a laptop, and troubleshoot local problems. |
| [Operations: production setup](operations/production-setup.md) | Prepare the first production environment (private beta). |
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

Nothing in these documents describes a production deployment as existing: as of the review date **no production environment has been configured** (no hosted Supabase project is linked to the repository, no frontend host is configured, no domain has been purchased).

## Unresolved questions and missing production decisions

This is the single list of open items; other documents link here instead of repeating it.

### Decisions not yet made

1. **Domain** — `visaoclara.pt` via Dominios.pt is a candidate; not purchased. ([ADR-0101](decisions/README.md#adr-0101-domain-registrar))
2. **Frontend hosting** — no provider is configured in the repository. ([ADR-0102](decisions/README.md#adr-0102-frontend-hosting))
3. **Transactional email (SMTP) provider** — Resend and Brevo are candidates; neither is integrated. ([ADR-0103](decisions/README.md#adr-0103-transactional-email-provider))
4. **Supabase production plan and region** — not chosen (affects backups and project pausing).
5. **Production Google OAuth client** — not created. The local client exists only on the developer's machine.
6. **Privacy notice / GDPR documentation** — not written.

### Facts that require confirmation

1. Whether the latest migration (`20261021120000_protect_profiles_plan.sql`) has been applied to the **local** database (it has not been applied to any production database, because none exists).
2. Whether the **full export** (ZIP + expenses spreadsheet) works: the Worker calls `get-project-expenses-xlsx` without a user JWT while that function keeps the default `verify_jwt = true`. See [data and storage](architecture/data-and-storage.md#zip-export).
3. Whether the **email confirmation** flow has been manually validated end to end after enabling `enable_confirmations` locally.
4. Whether the documents-only ZIP export has been manually validated (the last investigation found the test project had no uploaded files).
5. The original rationale for choosing Supabase, Cloudflare R2 and a Cloudflare Worker (see [ADRs](decisions/README.md)).

### Known gaps to address before or during the beta

Summarised here; details live in the linked documents.

- Plan limits other than AI quotas and export (`activeProjects`, `documentsPerProject`) are UI-only. ([data and storage](architecture/data-and-storage.md#plans-and-ai-quotas))
- `document_files.storage_key` can be modified by tenant members; `r2-sign-download` does not validate the key prefix (deletion does). ([data and storage](architecture/data-and-storage.md#storage-security-boundaries))
- Upload size (20 MB) is validated by the Edge Function but not enforced by the presigned URL. ([data and storage](architecture/data-and-storage.md#upload-flow))
- No account deletion / data export for users (GDPR requests are manual). ([production setup](operations/production-setup.md#15-security-checks))
- No automated tests and no CI. ([system overview](architecture/system-overview.md#known-architectural-limitations))
