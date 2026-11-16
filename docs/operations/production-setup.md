# Production setup checklist (private beta)

_Last reviewed: 2026-11-16_

**Nothing in this checklist has been configured in production yet.** Items marked `[x]` are completed preparation (repository work or decisions already taken); everything else is pending. Provider-specific steps that cannot be finalised are marked **TODO** and linked to the relevant [decision record](../decisions/README.md). Status labels are defined in the [documentation index](../README.md#status-vocabulary).

Work through the steps in order: later steps depend on earlier ones (domain → DNS → hosting → Supabase → Auth → email → storage → Worker → secrets → migrations → checks).

> **Approval required.** Per `CLAUDE.md`, deploying, running migrations against any database and changing Auth/RLS settings require explicit approval. Commands below are listed for reference, not for automatic execution.

Production host name: **`visaoclara.pt`** (registered with one.com, [ADR-0101](../decisions/README.md#adr-0101-domain-registrar)). Frontend hosting: **Netlify Free** ([ADR-0102](../decisions/0102-initial-hosting-strategy-netlify-free.md)) — chosen, **not yet deployed**. `<site>.netlify.app` stands for the Netlify-generated test URL and `<project-ref>` for the hosted Supabase project reference.

---

## 0. Status (2026-11-16) and deployment sequence

### Status

| Area | State | How it was established |
|---|---|---|
| Security hardening S1 (tenant isolation of document storage) | Implemented, committed, pushed. Needs migration `20261106100000_harden_document_files_storage` | Git history; unit tests |
| Security hardening S2 (upload policy, signed `Content-Type`/`Content-Length`/`If-None-Match`, 300 s URLs, object verification, cleanup, attachment downloads) | Implemented, committed, pushed | Git history; unit tests; real-R2 tests (earlier session) |
| Export flow (ZIP + Excel) | Code ready and tested locally, **not deployed anywhere**. `verify_jwt = false` for `get-project-expenses-xlsx` (approved 2026-11-16, that function only) is set in `config.toml` and takes effect when the function is deployed (see section 4) | Deno tests (`export_access_test.ts`, `auth_test.ts`, Worker `test/`), local workerd run |
| LOCAL Supabase | All 30 migrations applied | `supabase migration list --local` |
| DEV Supabase (`visao-clara-dev`) | 29 of 30 migrations (missing `20261106100000`); only `generate-checklist-suggestions` and `ai-chat-assistant` deployed; no R2/storage/export secrets | Read-only CLI listing |
| PROD Supabase (`visao-clara-prod`, Ireland) | Project exists; **no functions and no secrets**. Schema not verified (assume empty) | Read-only CLI listing |
| Cloudflare (R2 buckets, CORS, Worker), Netlify, DNS, Auth settings, Google OAuth, SMTP | Not verifiable from the repository; assume **not configured** | n/a |

### Sequence: rehearse on DEV, then repeat on PROD

Never reuse a secret between environments, and always pass `--project-ref` explicitly (the CLI link in `apps/api/supabase/.temp` points at DEV; the same login can reach PROD and unrelated projects).

1. **Repository**: all changes merged on `main`; `deno test --allow-env _shared/` and `deno test --no-lock --allow-env --allow-read=.. --import-map=_tests/import_map.json _tests/` (in `apps/api/supabase/functions`), `npm test` (in the Worker directory), `pnpm exec tsc --noEmit` and `pnpm lint` (in `apps/web`) pass.
2. **DEV database**: apply the missing migration (dry run first, approval required).
3. **DEV storage**: create a private DEV bucket and a bucket-scoped API token; set the CORS rule from section 9 for the origins you test from (`http://localhost:3001`, the Netlify test URL).
4. **DEV secrets** (`supabase secrets set --project-ref <dev-ref>`): the Edge Function secrets of section 11, with `FILE_STORAGE_PROVIDER=r2` and a DEV-only `EXPORT_JWT_SECRET`.
5. **DEV functions**: deploy every function of the list in section 4 (approval required).
6. **DEV Worker**: set `R2_BUCKET_NAME`/`bucket_name` in `[env.staging]`, run `wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging` and `wrangler secret put EXPORT_JWT_SECRET --env staging` (same value as the DEV Edge secret), then `npm run deploy:staging` (approval required).
7. **DEV smoke test** with `pnpm dev:cloud`: the checklist of section 16, including uploads, downloads, both exports, a cross-tenant check with two accounts and an expired export link. This rehearsal is also where the open questions below are answered.
8. **PROD**: repeat steps 2-6 against `visao-clara-prod`, with a separate PROD bucket, token and Worker (`--env production`) and new secrets. Then Auth, SMTP, Google, Netlify and DNS (sections 2-8, 13).
9. **PROD smoke test** with two disposable accounts before inviting anyone (section 16).

Open questions the DEV rehearsal must answer (they depend on dashboard settings): does the project issue legacy JWT or the newer publishable/secret keys; does the cloud Edge gateway accept the frontend's `Authorization: Bearer <anon key>` calls to the functions that keep `verify_jwt = true`; and do large exports fit the Workers CPU limit of the chosen plan.

---

## 1. Domain registration

- [x] Domain `visaoclara.pt` registered with one.com ([ADR-0101](../decisions/README.md#adr-0101-domain-registrar)).
- [ ] Auto-renewal enabled and the registrant contact details correct at one.com.

**Why:** Auth redirect URLs, the Google consent screen, email sender authentication and user trust all depend on a stable domain.
**Where:** one.com control panel.
**Validate:** `whois visaoclara.pt` shows the registration; one.com shows auto-renew on.
**What can go wrong:** An expired domain breaks login and email for every user.

## 2. DNS configuration

DNS stays at **one.com**; hosts are connected with records, not by delegating nameservers (portability principle in [ADR-0102](../decisions/0102-initial-hosting-strategy-netlify-free.md#portability-principles)).

- [ ] Decide the canonical host: `visaoclara.pt` (apex) with `www.visaoclara.pt` redirecting to it, or the reverse — **TODO**.
- [ ] Records for Netlify as instructed by Netlify's custom-domain setup for externally managed DNS (typically an apex `A`/`ALIAS` record and a `www` `CNAME` to `<site>.netlify.app`) [verify exact values in Netlify's domain settings].
- [ ] Email authentication records for the SMTP provider: SPF, DKIM, DMARC (values come from the provider — **TODO**, step 7).

**Why:** Routes users to the frontend and lets mailbox providers trust Auth emails.
**Where:** one.com DNS settings.
**Validate:** `dig visaoclara.pt` and `dig www.visaoclara.pt` return the Netlify targets; Netlify shows the domain as verified; the email provider's domain verification shows "verified".
**What can go wrong:** Missing DKIM/SPF sends confirmation and recovery emails to spam; existing one.com default records (parking page, mail) conflicting with the new ones; long TTLs slow down corrections.

## 3. Frontend hosting and custom domain (Netlify)

- [x] Hosting provider chosen: Netlify Free ([ADR-0102](../decisions/0102-initial-hosting-strategy-netlify-free.md); compatibility audit found no blockers).
- [x] Production build succeeds locally (`pnpm build`, 2026-10-21).

Ordered deployment steps (**none executed yet**):

1. [ ] **Create the Netlify project** in a Netlify team dedicated to Visão Clara (the Free credit limit is shared by every project in a team).
2. [ ] **Connect GitHub**: import the repository; production branch `main`.
3. [ ] **Monorepo build settings**: base directory `apps/web`; build command `pnpm build`; leave the publish directory to Netlify's Next.js adapter. Pin Node and pnpm to the local versions (pnpm 10.19.0; a Node version supported by Next.js 16) using Netlify's environment variables for build tool versions [verify names, e.g. `NODE_VERSION`, `PNPM_VERSION`]. Consider building production only on release (e.g. manual or tagged deploys): each production deploy costs 15 credits of the 300-credit monthly budget.
4. [ ] **Production environment variables** (scope: production context only): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WORKER_URL` (values from steps 4 and 10) and `NEXT_PUBLIC_APP_ENV=production`. The build (`apps/web/env-validation.cjs`) fails unless the URL is the `visao-clara-prod` project. Use Node ≥ 20.12. Do not give deploy previews production values.
5. [ ] **Test on `https://<site>.netlify.app`**: temporarily add this exact URL to the Supabase redirect allowlist (step 5), the Google OAuth origins (step 6) and R2 CORS (step 9); run the smoke tests (step 16).
6. [ ] **Connect `visaoclara.pt`**: add the custom domain in Netlify, create the records at one.com (step 2), wait for the HTTPS certificate.
7. [ ] **Switch Auth to the domain**: Supabase Site URL and redirect URLs (step 5), Google OAuth origin (step 6), R2 CORS (step 9) use `https://visaoclara.pt`; remove the temporary `netlify.app` entries once no longer needed.
8. [ ] **Validate before inviting beta users**: repeat the smoke tests (step 16) on `https://visaoclara.pt` and check the Netlify credit usage after the first days.

**Why:** The app is fully client-side; Netlify serves static pages from its CDN and server-renders the dynamic `/[projectId]/*` routes.
**Where:** Netlify project settings (build, environment variables, domains). Keep any optional `netlify.toml` limited to build settings.
**Validate:** The site loads over HTTPS on both URLs; the browser network tab shows calls only to the production Supabase URL and Worker; the Netlify usage page shows expected credit consumption.
**What can go wrong:** `NEXT_PUBLIC_*` values are compiled in at build time — changing them requires a new deploy (15 credits); deploy previews with production keys expose production data to anyone with the preview URL; exhausting 300 credits **pauses every project in the team** until the next cycle.

## 4. Supabase production project

- [ ] Choose plan and region (**TODO**; an EU region suits Portuguese users and GDPR). The plan determines backups and whether an idle project is paused [verify current Supabase pricing].
- [ ] Create the project; store the database password in a password manager.
- [ ] Note the project URL and API keys (anon/publishable and service-role/secret). Check whether the project issues legacy JWT keys or the newer key format; the frontend and the gateway convention (anon key in `Authorization`) assume a JWT-format anon key [verify].
- [ ] Link the CLI only when deploying, and always confirm the target: `supabase link --project-ref <project-ref>` (from `apps/api`).
- [ ] Apply all 30 migrations **before** deploying any function (the S2 functions rely on the grants of `20261106100000`).
- [ ] Deploy all Edge Functions below (`supabase functions deploy <name> --project-ref <ref>`, approval required) and verify each function's JWT setting in the dashboard.

| Function | Needed for | Authenticates in code by | `verify_jwt` today (`config.toml`) |
|---|---|---|---|
| `r2-sign-upload`, `r2-sign-download`, `r2-confirm-upload`, `cleanup-pending-uploads` | Documents (upload, download, cleanup) | `requireUser` (user token) | `false` |
| `delete-document` | Documents (delete) | `requireUser` | default (`true`) |
| `generate-checklist-suggestions`, `ai-chat-assistant` | AI | `requireUser` | `false` |
| `export-project-expenses` | Excel export (Pro) | `requireUser` + plan check | default (`true`) |
| `authorize-project-documents-export` | Issues the short-lived export token (Pro) | `requireUser` + plan + RLS project lookup | default (`true`) |
| `get-project-expenses-xlsx` | Spreadsheet inside the full ZIP export | **export token** (HS256, issuer, audience, scope, project), not a user token | `false` (approved 2026-11-16, see below) |

**`get-project-expenses-xlsx` and `verify_jwt` (approved 2026-11-16 for this function only; set in `config.toml`).** The Worker calls this function server-to-server and sends no `Authorization` header, so with `verify_jwt = true` the gateway answers 401 ("Missing authorization header") before the function runs and the **full export cannot work**. Checked against the local gateway on 2026-11-16: the gateway also accepts the *public* anon key, and the function then rejects a forged export token (`401 INVALID_TOKEN`). So the gateway check adds no authentication to this endpoint; the real control is the function's own token verification (`EXPORT_VERIFY_OPTIONS`: issuer, audience, HS256 only, expiry; then `parseExportClaims`: UUID claims, scope, project binding), covered by `_shared/export_access_test.ts` and, for the real handler, `_tests/get_project_expenses_xlsx_test.ts` (missing, forged, expired, wrong-issuer/audience/algorithm, wrong-scope and other-project tokens are refused with nothing read; only the token's tenant and project are exported; missing configuration fails closed). `_tests/verify_jwt_config_test.ts` fails if any function other than the approved ones gets a `verify_jwt` entry or if an approved function stops authenticating in code. The setting in `config.toml`:

```toml
[functions.get-project-expenses-xlsx]
verify_jwt = false
```

It reaches DEV and PROD only when `get-project-expenses-xlsx` is deployed (`supabase functions deploy get-project-expenses-xlsx --project-ref <ref>`, approval required); the CLI takes the setting from `config.toml`, so confirm it in the dashboard afterwards. The alternative of forwarding the public anon key from the Worker was rejected: it needs a JWT-format anon key and gives no real protection.

The same question applies to the three other functions that keep `verify_jwt = true` and are called with the anon key in `Authorization` (`delete-document`, `export-project-expenses`, `authorize-project-documents-export`): they all authenticate the user in code. If the DEV rehearsal shows the cloud gateway rejecting the frontend's calls (for example with publishable-format keys), they need the same decision.

**Why:** Hosts the database, Auth and Edge Functions.
**Validate:** Dashboard shows all functions deployed; a request to `/functions/v1/r2-sign-download` without a token returns 401 from `requireUser`.
**What can go wrong:** Running `supabase db reset --linked` against the linked project **destroys production data** — never do it. Do not push the local `config.toml` Auth settings to production (`site_url` is `localhost`).

## 5. Supabase Auth: Site URL and redirect allowlist

- [ ] Site URL: `https://visaoclara.pt` (use `https://<site>.netlify.app` only while testing before the domain is connected).
- [ ] Redirect URLs (exact, no wildcards): `https://visaoclara.pt/auth/callback`, `https://visaoclara.pt/auth/reset-password`.
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
- [ ] OAuth client (Web application): JavaScript origin `https://visaoclara.pt` (plus `https://<site>.netlify.app` while testing); redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] Client ID and secret entered in Supabase → Authentication → Providers → Google.

**Why:** "Continuar com Google" is a primary sign-in method.
**Validate:** A test user signs in with Google on production; `auth.identities` contains a `google` identity.
**What can go wrong:** `invalid_client` (wrong or missing credentials), `redirect_uri_mismatch` (redirect URI not exactly the Supabase callback), test-user restrictions while the app is in Testing.

## 7. Transactional email provider and SMTP

- [ ] Choose the provider (**TODO**, [ADR-0103](../decisions/README.md#adr-0103-transactional-email-provider); candidates Resend, Brevo — neither integrated).
- [ ] Verify the sending domain (SPF/DKIM/DMARC from step 2), e.g. a sender such as `no-reply@visaoclara.pt`.
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
- [ ] **Bucket CORS rule.** S2 requires `If-None-Match`; without it the browser's preflight fails and every upload is refused. Only `PUT` is needed: uploads are browser `fetch` calls to presigned URLs, downloads are plain navigations. Use exact origins, no wildcard:

```json
[
  {
    "AllowedOrigins": ["https://visaoclara.pt"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "If-None-Match"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

  Add `https://<site>.netlify.app` (and `http://localhost:3001` on the DEV bucket) only while testing, then remove it. `Content-Length` is signed too but the browser sets it itself, so it needs no CORS entry.
- [ ] Decide the **jurisdiction before creating the bucket**: the EU jurisdiction cannot be changed later (the Supabase PROD project is in Ireland). For an EU bucket set `VC_R2_ENDPOINT=https://<account_id>.eu.r2.cloudflarestorage.com`.
- [ ] One bucket and one API token **per environment** (DEV and PROD never share either). The Worker reaches the bucket through its binding; the Edge Functions use the S3 API token.
- [ ] Decide on object backup/replication (step 14).

**Why:** Stores all uploaded documents.
**Validate:** Upload, download and delete a file; the object appears and disappears under `<tenant>/<project>/<document>/<file>/` in the bucket. A wrong type or size is refused by R2 itself (403) and a second PUT to the same key by R2 (412).
**What can go wrong:** Missing CORS (especially `If-None-Match`) → uploads fail in the browser while the function succeeds; a public bucket exposes every document. Abandoned uploads are not cleaned up yet (see "Agendamento da limpeza" in `apps/api/README.md`): acceptable for a small beta, to be scheduled before opening up.

## 10. Cloudflare Worker

The Worker (`apps/api/cloudflare-workers/export-documents-worker`) streams the documents ZIP and, for the full export, adds the expenses spreadsheet. ZIP and Excel export are part of the beta, so it must be deployed for **each** environment.

**How the export works.** The browser asks `authorize-project-documents-export` for a token (user token, Pro plan, project visible through RLS), then opens `<WORKER_URL>/?token=…` in a new tab. The token is an HS256 JWT valid for 300 s (issuer `visao-clara-edge`, audience `visao-clara-worker`) carrying `project_id`, `tenant_id` (taken from the project row, never from the request), `user_id` and `scope` (`documents_export` or `full_export`). The Worker verifies it, reads **only** `uploaded` files of that tenant and project with the service-role key, validates every row's storage identity (S1) and every object's existence, then streams the ZIP from the private R2 binding. For `full_export` it first fetches the spreadsheet from `get-project-expenses-xlsx` with the same token. Any failure before the first byte is an error response; nothing is partially served.

Requirements per environment:

- [ ] Cloudflare account with R2 enabled and the environment's private bucket (section 9). Workers plan: the ZIP is built with zip.js (CRC32 over every byte), so CPU time grows with export size. Plan on the **Workers Paid** plan; the Free plan CPU limit is far too small for real exports [verify the current limits on Cloudflare's pricing page].
- [ ] `wrangler.toml`: replace the `R2_BUCKET_NAME` **and** `bucket_name` placeholders (`replace-with-…-r2-bucket-name`) in `[env.staging]` / `[env.production]` with the real bucket. Both must be identical, and the Worker refuses rows that point at any other bucket. `SUPABASE_URL` is already set per environment.
- [ ] Secrets, per environment: `wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env <staging|production>` and `wrangler secret put EXPORT_JWT_SECRET --env <staging|production>`. `EXPORT_JWT_SECRET` must be **identical** to the same-named Edge Function secret of that environment, and different between DEV and PROD.
- [ ] Edge Functions `authorize-project-documents-export` and `get-project-expenses-xlsx` deployed to the same project (section 4), (`verify_jwt = false` is already in `config.toml`; the function must be redeployed for it to take effect).
- [ ] Deploy with `npm run deploy:staging` / `npm run deploy` (approval required). `npx wrangler deploy --dry-run --env <env>` bundles without deploying and is a safe pre-check.
- [ ] Set `NEXT_PUBLIC_WORKER_URL` in Netlify (production context) to the Worker URL (the `workers.dev` URL is fine for the beta; a custom domain such as `export.visaoclara.pt` can come later). It is compiled into the build, so changing it needs a new deploy.
- [ ] No CORS configuration is needed: the browser navigates to the Worker, it does not call it with `fetch`.

**Tests** (no network, no cloud): `npm test` in the Worker directory (needs Deno) runs the real Worker code against a mock Supabase and a mock R2 binding. Invalid, expired, forged, wrong-scope and malformed tokens are refused and nothing is read; only the token's tenant and project are exported; inconsistent rows or keys fail closed; the ZIP contents and the spreadsheet hop are checked. On 2026-11-16 the Worker was also run under the real Workers runtime (`wrangler dev --local` with a simulated R2 bucket): a 3 MB file and a generated `.xlsx` came out of both exports byte-identical and `unzip -t` was clean.

**Validate (DEV first):** a Pro test user exports a project with uploaded files and receives both ZIPs; the full ZIP contains `visao-clara-despesas.xlsx` and `documentos/…`; a `free` user gets the "requires Pro" message; an expired link returns 401 JSON.
**What can go wrong:** mismatched `EXPORT_JWT_SECRET` → every export returns 401 `INVALID_TOKEN`; bucket name mismatch → 409 `STORAGE_LOCATION_UNTRUSTED`; the gateway rejecting the Worker's call to `get-project-expenses-xlsx` → 502 `XLSX_FETCH_FAILED` on the full export only; Workers CPU limit exceeded on large projects; the service-role key leaked from the Worker gives full database access. Known limits: the token travels in the URL (valid 300 s; visible in browser history and in Worker and gateway logs); a project without documents answers the documents export with a JSON 404 in the new tab; wrangler 3 is outdated (upgrading needs approval).

## 11. Environment variables and secret management

No environment files are used in production. Values belong in the provider secret stores; names are documented by the tracked `*.example` files.

| Location | Variables |
|---|---|
| Netlify (production context) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WORKER_URL`, `NEXT_PUBLIC_APP_ENV=production` |
| Supabase Edge Function secrets (`supabase secrets set` or dashboard) | `VC_SUPABASE_URL`, `VC_SUPABASE_ANON_KEY`, `FILE_STORAGE_PROVIDER=r2`, `VC_R2_ACCOUNT_ID`, `VC_R2_ENDPOINT` (optional; required for EU jurisdiction buckets: `https://<account_id>.eu.r2.cloudflarestorage.com`), `VC_R2_ACCESS_KEY_ID`, `VC_R2_SECRET_ACCESS_KEY`, `VC_R2_BUCKET`, `VC_R2_REGION`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `EXPORT_JWT_SECRET` (`SUPABASE_SERVICE_ROLE_KEY` is provided by the platform [verify]) |
| Supabase dashboard | Google client ID/secret, SMTP credentials |
| Cloudflare Worker | `SUPABASE_SERVICE_ROLE_KEY`, `EXPORT_JWT_SECRET` (secrets); `SUPABASE_URL`, `STORAGE_PROVIDER`, `S3_REGION` (vars in `wrangler.toml`); `R2_BUCKET` binding |

- [ ] All production secrets are different from local ones **and from DEV**.
- [ ] `VC_SUPABASE_URL` and `VC_SUPABASE_ANON_KEY` are set explicitly as function secrets (the CLI ignores names starting with `SUPABASE_` in env files, and the functions read the `VC_` names).
- [ ] Secrets stored in a password manager with an owner.
- [ ] OpenAI: a dedicated production project/key with a monthly budget limit and alerts.

**Validate:** Search the built frontend bundle for `service_role` and storage key names — no matches.
**What can go wrong:** A secret in `NEXT_PUBLIC_*` is public; reusing local secrets in production.

## 12. Database migrations and RLS validation

- [ ] Prove the migration chain replays on an empty database (locally, intentionally, with `supabase db reset` — ⚠️ destroys local data).
- [ ] With the production project linked: `supabase db push --dry-run`, review, then `supabase db push` (approval required).
- [ ] `supabase migration list` shows all 30 migrations applied remotely. The 30th, `20261106100000_harden_document_files_storage`, is S1: it removes client INSERT/UPDATE on `document_files`, and DEV does not have it yet.
- [ ] RLS checks with two accounts in different tenants: B cannot read A's projects, documents, files or expenses; cross-tenant document ids return 404 from `delete-document` and `r2-sign-download`.
- [ ] Plan protection: as a normal user, `update profiles set plan = 'premium'` fails with `42501`; the SQL Editor can change it.

**Why:** Migrations are forward-only; production must match the schema the code expects, and RLS is the only data-isolation layer.
**What can go wrong:** A partially applied migration; editing an old migration instead of adding a new one; assuming local migration state equals production.

## 13. HTTPS and domain verification

- [ ] HTTPS active on `visaoclara.pt` (certificate issued by the host).
- [ ] Domain verified for the email provider (step 7) and, if required, for the Google consent screen branding.
- [ ] Supabase Site URL and redirect URLs use `https://`.

**Validate:** No mixed-content warnings; `curl -I https://visaoclara.pt` returns 200/3xx with a valid certificate.

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
- [x] Storage-key identity check in `r2-sign-download`, `r2-confirm-upload`, `delete-document` and the Worker (S1).
- [x] 20 MB limit, allowed types, signed `Content-Type`/`Content-Length`, overwrite protection (R2) and object verification at confirm (S2).
- [x] Authentication errors carry CORS headers (the browser can read a 401). Export tokens are verified with a pinned algorithm, issuer, audience, UUID claims and scope, and an invalid or expired token is a 401 (it used to be a 500).
- [ ] Consider removing `public.debug_auth_context()`.
- [ ] OpenAI budget limit set (step 11).
- [ ] Privacy notice and beta terms published (**TODO**: content and URL), listing processors (Supabase, Cloudflare, OpenAI, Netlify, the email provider).
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
- [ ] Full export (ZIP + spreadsheet) with a `pro` account: the ZIP opens and contains the spreadsheet and the documents.
- [ ] Export with an expired link (wait 5 minutes) → 401; export with a `free` account → refused.
- [ ] Upload an `.exe` renamed to `.pdf` → refused (422); upload a 21 MB file → refused before the upload.
- [ ] AI checklist suggestions and chat; quota message after the limit (use a `free` account: 2 suggestions, 10 messages).
- [ ] Cross-tenant checks from step 12.

## 17. Rollback and incident response

| Component | Rollback |
|---|---|
| Frontend | Netlify: publish a previous production deploy (rollbacks cost 0 credits per Netlify's credit table) |
| Edge Functions | Check out the previous Git tag and `supabase functions deploy <name>` |
| Worker | Redeploy the previous version (`wrangler rollback` [verify]) |
| Database | **Forward-only**: write a new corrective migration. Restore from backup only as a last resort (loses data written since the backup) |

- [ ] Use expand/contract migrations (add before remove) so the previous frontend keeps working after a migration.
- [ ] Tag releases in Git so functions and Worker can be redeployed from a known version.
- [ ] Incident basics: who is contacted, where logs are (Supabase logs, Worker logs, host logs), how beta users are informed, and how a leaked key is rotated (Supabase keys, R2 token, OpenAI key, `EXPORT_JWT_SECRET`, Google secret).

Open decisions referenced above are tracked in the [documentation index](../README.md#unresolved-questions-and-missing-production-decisions).
