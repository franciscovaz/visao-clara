# Production setup checklist (private beta)

_Last reviewed: 2026-10-21_

**Nothing in this checklist has been configured in production yet.** Items marked `[x]` are preparation work completed in the repository; everything else is pending. Provider-specific steps that cannot be finalised are marked **TODO** and linked to the relevant [decision record](../decisions/README.md). Status labels are defined in the [documentation index](../README.md#status-vocabulary).

Work through the steps in order: later steps depend on earlier ones (domain → DNS → hosting → Supabase → Auth → email → storage → Worker → secrets → migrations → checks).

> **Approval required.** Per `CLAUDE.md`, deploying, running migrations against any database and changing Auth/RLS settings require explicit approval. Commands below are listed for reference, not for automatic execution.

Placeholders used below: `app.<domain>` for the frontend host name and `<project-ref>` for the hosted Supabase project reference.

---

## 1. Domain registration

- [ ] Decide the domain and registrar (**TODO**, [ADR-0101](../decisions/README.md#adr-0101-domain-registrar)). Candidate: `visaoclara.pt` via Dominios.pt — **not purchased**.
- [ ] Register the domain and enable auto-renewal.

**Why:** Auth redirect URLs, the Google consent screen, email sender authentication and user trust all depend on a stable domain.
**Where:** Registrar account.
**Validate:** `whois` shows the registration; registrar dashboard shows auto-renew on.
**What can go wrong:** `.pt` registrations have eligibility/holder requirements [verify with the registrar/DNS.PT]; an expired domain breaks login and email for every user.

## 2. DNS configuration

- [ ] Decide where DNS is hosted (registrar or a DNS provider) — **TODO**.
- [ ] Record for the frontend host (`app.<domain>`, per the hosting provider's instructions).
- [ ] Email authentication records for the SMTP provider: SPF, DKIM, DMARC (values come from the provider — **TODO**, step 7).

**Why:** Routes users to the frontend and lets mailbox providers trust Auth emails.
**Validate:** `dig app.<domain>`; the email provider's domain verification shows "verified".
**What can go wrong:** Missing DKIM/SPF sends confirmation and recovery emails to spam; long TTLs slow down corrections.

## 3. Frontend hosting and custom domain

- [ ] Choose the hosting provider (**TODO**, [ADR-0102](../decisions/README.md#adr-0102-frontend-hosting)). The repository contains no hosting configuration.
- [ ] Project settings: root directory `apps/web`, package manager pnpm (lockfile in `apps/web`), build command `pnpm build`.
- [ ] Production environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WORKER_URL` (values from steps 4 and 10).
- [ ] Preview/branch deployments disabled, protected, or pointed at a non-production backend.
- [x] Production build succeeds locally (`pnpm build`, 2026-10-21).
- [ ] Custom domain `app.<domain>` attached with HTTPS.

**Why:** The app is fully client-side; the host only serves the built Next.js application.
**Validate:** The deployed site loads over HTTPS; the browser network tab shows calls to the production Supabase URL only.
**What can go wrong:** `NEXT_PUBLIC_*` values are compiled in at build time — changing them requires a rebuild; preview deployments with production keys expose production data to anyone with the preview URL.

## 4. Supabase production project

- [ ] Choose plan and region (**TODO**; an EU region suits Portuguese users and GDPR). The plan determines backups and whether an idle project is paused [verify current Supabase pricing].
- [ ] Create the project; store the database password in a password manager.
- [ ] Note the project URL and API keys (anon/publishable and service-role/secret). Check whether the project issues legacy JWT keys or the newer key format; the frontend and the gateway convention (anon key in `Authorization`) assume a JWT-format anon key [verify].
- [ ] Link the CLI only when deploying, and always confirm the target: `supabase link --project-ref <project-ref>` (from `apps/api`).
- [ ] Deploy Edge Functions (`supabase functions deploy`, approval required) and verify each function's JWT setting in the dashboard: `verify_jwt = false` only for `r2-sign-upload`, `r2-sign-download`, `r2-confirm-upload`, `cleanup-pending-uploads`.
- [ ] Decide on `get-project-expenses-xlsx` (needs `verify_jwt = false` for the full ZIP export to work; see [ZIP export](../architecture/data-and-storage.md#zip-export)).

**Why:** Hosts the database, Auth and Edge Functions.
**Validate:** Dashboard shows all functions deployed; a request to `/functions/v1/r2-sign-download` without a token returns 401 from `requireUser`.
**What can go wrong:** Running `supabase db reset --linked` against the linked project **destroys production data** — never do it. Do not push the local `config.toml` Auth settings to production (`site_url` is `localhost`).

## 5. Supabase Auth: Site URL and redirect allowlist

- [ ] Site URL: `https://app.<domain>`.
- [ ] Redirect URLs (exact, no wildcards): `https://app.<domain>/auth/callback`, `https://app.<domain>/auth/reset-password`.
- [ ] "Confirm email" enabled.
- [ ] Minimum password length ≥ 8 (the frontend enforces 8; the server default is lower [verify]).
- [ ] Review Auth rate limits.

**Why:** Supabase only redirects to allow-listed URLs; otherwise it falls back to the Site URL and confirmation/recovery/OAuth flows land on the wrong page.
**Where:** Supabase dashboard → Authentication → URL configuration / Providers / Policies.
**Validate:** Register, confirm and recover a test account; each link lands on the expected page.
**What can go wrong:** Wildcard redirect URLs allow tokens to be sent to unintended hosts (e.g. preview deployments).

## 6. Google OAuth production credentials

- [ ] Google Cloud project owned by a long-lived project account (the local development client lives on the developer's machine and is not suitable for production).
- [ ] OAuth consent screen: app name "Visão Clara", support email, logo (optional), privacy policy URL (step 15), scopes `openid`, `email`, `profile`; add beta users as test users, or publish the app.
- [ ] OAuth client (Web application): JavaScript origin `https://app.<domain>`; redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] Client ID and secret entered in Supabase → Authentication → Providers → Google.

**Why:** "Continuar com Google" is a primary sign-in method.
**Validate:** A test user signs in with Google on production; `auth.identities` contains a `google` identity.
**What can go wrong:** `invalid_client` (wrong or missing credentials), `redirect_uri_mismatch` (redirect URI not exactly the Supabase callback), test-user restrictions while the app is in Testing.

## 7. Transactional email provider and SMTP

- [ ] Choose the provider (**TODO**, [ADR-0103](../decisions/README.md#adr-0103-transactional-email-provider); candidates Resend, Brevo — neither integrated).
- [ ] Verify the sending domain (SPF/DKIM/DMARC from step 2), e.g. a sender such as `no-reply@<domain>`.
- [ ] Enter SMTP host, port, user, password and sender in Supabase → Authentication → SMTP settings.

**Why:** Supabase's built-in mailer is meant for testing and is heavily rate-limited [verify current limits]; production confirmation and recovery emails need a real provider.
**Validate:** Confirmation and recovery emails arrive in Gmail and Outlook inboxes (not spam) within a minute.
**What can go wrong:** Unverified domain → rejected or spam-foldered mail; provider free-tier daily limits.

## 8. Email templates

- [x] Branded pt-PT templates exist: `apps/api/supabase/templates/confirmation.html`, `recovery.html`, `email_change.html` (subjects in `config.toml`).
- [ ] Paste each template and subject into Supabase → Authentication → Email Templates (Confirm signup, Reset password, Change email address).
- [ ] Send a test of each template.

**Why:** Local templates are not applied to hosted projects automatically.
**Validate:** Received emails show pt-PT text, the button works, and the fallback link works.
**What can go wrong:** Editing `{{ .ConfirmationURL }}` breaks every link; templates intentionally show no OTP codes.

## 9. Cloudflare R2

- [x] R2 code path exists (`FILE_STORAGE_PROVIDER=r2`, `VC_R2_*`).
- [ ] Create a **private** production bucket (no public `r2.dev` access). Consider the EU jurisdiction option [verify availability].
- [ ] Create an R2 API token scoped to that bucket with object read/write.
- [ ] Bucket CORS rule allowing `PUT` and `GET` from `https://app.<domain>` with the `Content-Type` header (the browser uploads directly with presigned URLs).
- [ ] Decide on object backup/replication (step 14).

**Why:** Stores all uploaded documents.
**Validate:** Upload, download and delete a file on production; the object appears and disappears under `<tenant>/<project>/<document>/<file>/` in the bucket.
**What can go wrong:** Missing CORS → uploads fail in the browser while the function succeeds; a public bucket exposes every document.

## 10. Cloudflare Worker

- [ ] Fill in `wrangler.toml` `[env.production]`: `SUPABASE_URL` and the R2 `bucket_name` (currently placeholders).
- [ ] Set secrets: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production` and `wrangler secret put EXPORT_JWT_SECRET --env production` (same `EXPORT_JWT_SECRET` as the Edge Functions).
- [ ] Deploy with `npm run deploy` (`wrangler deploy --env production`, approval required).
- [ ] Set `NEXT_PUBLIC_WORKER_URL` in the frontend host to the Worker URL (or a custom route).
- [ ] Review `compatibility_date` (currently `2024-01-01`) and the CPU-time limits of the chosen Workers plan for large ZIPs [verify].

**Why:** Streams document ZIP exports without loading files into an Edge Function.
**Validate:** A pro/premium test user exports a project with uploaded files and receives a ZIP; a request with an expired token returns 401.
**What can go wrong:** Mismatched `EXPORT_JWT_SECRET` → every export returns `INVALID_TOKEN`; service-role key leaked from the Worker gives full database access.

## 11. Environment variables and secret management

No environment files are used in production. Values belong in the provider secret stores; names are documented by the tracked `*.example` files.

| Location | Variables |
|---|---|
| Frontend host | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WORKER_URL` |
| Supabase Edge Function secrets (`supabase secrets set` or dashboard) | `VC_SUPABASE_URL`, `VC_SUPABASE_ANON_KEY`, `FILE_STORAGE_PROVIDER=r2`, `VC_R2_ACCOUNT_ID`, `VC_R2_ACCESS_KEY_ID`, `VC_R2_SECRET_ACCESS_KEY`, `VC_R2_BUCKET`, `VC_R2_REGION`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `EXPORT_JWT_SECRET` (`SUPABASE_SERVICE_ROLE_KEY` is provided by the platform [verify]) |
| Supabase dashboard | Google client ID/secret, SMTP credentials |
| Cloudflare Worker | `SUPABASE_SERVICE_ROLE_KEY`, `EXPORT_JWT_SECRET` (secrets); `SUPABASE_URL`, `STORAGE_PROVIDER`, `S3_REGION` (vars in `wrangler.toml`); `R2_BUCKET` binding |

- [ ] All production secrets are different from local ones.
- [ ] Secrets stored in a password manager with an owner.
- [ ] OpenAI: a dedicated production project/key with a monthly budget limit and alerts.

**Validate:** Search the built frontend bundle for `service_role` and storage key names — no matches.
**What can go wrong:** A secret in `NEXT_PUBLIC_*` is public; reusing local secrets in production.

## 12. Database migrations and RLS validation

- [ ] Prove the migration chain replays on an empty database (locally, intentionally, with `supabase db reset` — ⚠️ destroys local data).
- [ ] With the production project linked: `supabase db push --dry-run`, review, then `supabase db push` (approval required).
- [ ] `supabase migration list` shows all 27 migrations applied remotely.
- [ ] RLS checks with two accounts in different tenants: B cannot read A's projects, documents, files or expenses; cross-tenant document ids return 404 from `delete-document` and `r2-sign-download`.
- [ ] Plan protection: as a normal user, `update profiles set plan = 'premium'` fails with `42501`; the SQL Editor can change it.

**Why:** Migrations are forward-only; production must match the schema the code expects, and RLS is the only data-isolation layer.
**What can go wrong:** A partially applied migration; editing an old migration instead of adding a new one; assuming local migration state equals production.

## 13. HTTPS and domain verification

- [ ] HTTPS active on `app.<domain>` (certificate issued by the host).
- [ ] Domain verified for the email provider (step 7) and, if required, for the Google consent screen branding.
- [ ] Supabase Site URL and redirect URLs use `https://`.

**Validate:** No mixed-content warnings; `curl -I https://app.<domain>` returns 200/3xx with a valid certificate.

## 14. Backup and recovery

- [ ] Database: confirm the backup capability of the chosen Supabase plan [verify]; otherwise schedule `supabase db dump` exports from a trusted machine.
- [ ] Document and test a restore into a non-production project.
- [ ] R2: decide on a periodic copy of the bucket (no backup is configured; deleted objects are not recoverable).
- [ ] Record where backups live and who can access them (they contain personal data).

**Why:** Beta users will store real project documents and invoices.
**What can go wrong:** Untested backups; restoring a database without the matching storage objects (or vice versa).

## 15. Security checks

- [ ] Service-role key absent from the frontend bundle and repository.
- [ ] RLS cross-tenant tests (step 12) pass.
- [x] `profiles.plan` protected by column privileges (migration written; must be applied in step 12).
- [x] Sensitive auth console logging removed from the frontend.
- [ ] Add the storage-key prefix check to `r2-sign-download` (gap documented in [data and storage](../architecture/data-and-storage.md#storage-security-boundaries)).
- [ ] Decide on enforcing the 20 MB upload limit at storage level.
- [ ] Consider removing `public.debug_auth_context()`.
- [ ] OpenAI budget limit set (step 11).
- [ ] Privacy notice and beta terms published (**TODO**: content and URL), listing processors (Supabase, Cloudflare, OpenAI, the frontend host, the email provider).
- [ ] Manual procedure for data access/deletion requests (there is no in-app account deletion): delete the user's tenant data, storage prefix `<tenant_id>/`, and the Auth user.

## 16. Smoke tests before inviting beta users

Run on production with dedicated test accounts:

- [ ] Email registration → confirmation email → callback → onboarding → dashboard.
- [ ] Login before confirming shows the pt-PT message; resend works.
- [ ] Google sign-up with onboarding answers; existing Google user login.
- [ ] Password recovery end to end; old password rejected.
- [ ] Logout returns to `/login`; no data remains visible.
- [ ] Create tasks, expenses, responsáveis.
- [ ] Upload, download and delete a document (PDF and image).
- [ ] Expenses Excel export and documents ZIP export with a `pro` account; `free` account receives the "requires Pro" message.
- [ ] Full export (ZIP + spreadsheet) — expected to fail until the `get-project-expenses-xlsx` JWT setting is resolved.
- [ ] AI checklist suggestions and chat; quota message after the limit (use a `free` account: 2 suggestions, 10 messages).
- [ ] Cross-tenant checks from step 12.

## 17. Rollback and incident response

| Component | Rollback |
|---|---|
| Frontend | Redeploy the previous build in the host (provider-specific, **TODO**) |
| Edge Functions | Check out the previous Git tag and `supabase functions deploy <name>` |
| Worker | Redeploy the previous version (`wrangler rollback` [verify]) |
| Database | **Forward-only**: write a new corrective migration. Restore from backup only as a last resort (loses data written since the backup) |

- [ ] Use expand/contract migrations (add before remove) so the previous frontend keeps working after a migration.
- [ ] Tag releases in Git so functions and Worker can be redeployed from a known version.
- [ ] Incident basics: who is contacted, where logs are (Supabase logs, Worker logs, host logs), how beta users are informed, and how a leaked key is rotated (Supabase keys, R2 token, OpenAI key, `EXPORT_JWT_SECRET`, Google secret).

Open decisions referenced above are tracked in the [documentation index](../README.md#unresolved-questions-and-missing-production-decisions).
