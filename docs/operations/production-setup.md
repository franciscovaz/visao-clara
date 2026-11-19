# Production setup checklist (private beta)

_Last reviewed: 2026-11-19_

**Nothing in this checklist has been configured in production yet.** The DEV rehearsal is complete (section 0). Items marked `[x]` are completed preparation (repository work, DEV rehearsal or decisions already taken); everything else is pending. Provider-specific steps that cannot be finalised are marked **TODO** and linked to the relevant [decision record](../decisions/README.md). Status labels are defined in the [documentation index](../README.md#status-vocabulary).

Work through the steps in order: later steps depend on earlier ones (domain → DNS → hosting → Supabase → Auth → email → storage → Worker → secrets → migrations → checks).

> **Approval required.** Per `CLAUDE.md`, deploying, running migrations against any database and changing Auth/RLS settings require explicit approval. Commands below are listed for reference, not for automatic execution.

**Decisions (2026-11-19):**

- Canonical production origin: **`https://www.visaoclara.pt`**. The apex `https://visaoclara.pt` only redirects (301) to it ([ADR-0102 verification note](../decisions/0102-initial-hosting-strategy-netlify-free.md#verification-note-2026-11-19)).
- Domain `visaoclara.pt` registered and DNS managed at **one.com**; the one.com nameservers stay in place ([ADR-0101](../decisions/README.md#adr-0101-domain-registrar)).
- Frontend hosting: **Netlify Free** ([ADR-0102](../decisions/0102-initial-hosting-strategy-netlify-free.md)), not yet created. Production deploys are **manually controlled** (section 3).
- Supabase PROD (`visao-clara-prod`, Ireland) stays on the **Free plan** for now, monitored manually by the owner ([ADR-0104](../decisions/README.md#adr-0104-supabase-production-plan-free-initially); risks in section 4).
- DEV and PROD stay fully isolated: separate Supabase projects, buckets, API tokens, Workers and secrets.

Placeholders: `<site>.netlify.app` is the Netlify-generated URL of the production site (the name is chosen when the site is created); `<account_id>` is the Cloudflare account id. The PROD Supabase project reference `owmryjakruspyxrwgldx` is public (it is part of every API URL and is pinned in `apps/web/env-validation.cjs`).

### Production URL reference

Every production setting uses the canonical origin **exactly** (`https`, `www`, no trailing slash, no wildcards). The apex is never needed in these settings: it redirects at Netlify before the app loads, and the app builds every Auth redirect from `window.location.origin`.

| Where | Production value | Temporary (remove after the domain cutover, section 3 step 11) |
|---|---|---|
| Netlify primary domain | `www.visaoclara.pt`; `visaoclara.pt` added as the redirecting domain | `<site>.netlify.app` (always exists; not used once the domain is live) |
| Supabase Auth → Site URL | `https://www.visaoclara.pt` | `https://<site>.netlify.app` before the cutover |
| Supabase Auth → Redirect URLs | `https://www.visaoclara.pt/auth/callback`, `https://www.visaoclara.pt/auth/reset-password` | the same two paths on `https://<site>.netlify.app` |
| Google OAuth client → JavaScript origins | `https://www.visaoclara.pt` | `https://<site>.netlify.app` |
| Google OAuth client → Redirect URI | `https://owmryjakruspyxrwgldx.supabase.co/auth/v1/callback` (Supabase, not the app) | — |
| Google consent screen | Home page `https://www.visaoclara.pt`, privacy `https://www.visaoclara.pt/privacidade`, terms `https://www.visaoclara.pt/termos`; authorised domain `visaoclara.pt` | — |
| R2 PROD bucket CORS → AllowedOrigins | `https://www.visaoclara.pt` | `https://<site>.netlify.app` |
| Netlify env `NEXT_PUBLIC_WORKER_URL` | the production Worker's `workers.dev` URL | — |
| Legal pages and app metadata | Served at `/privacidade` and `/termos` on the canonical origin. The code contains no absolute production URL (root metadata has no `metadataBase`/canonical; links are relative); if one is added later, use `https://www.visaoclara.pt` | — |

Environments that keep their own values (never replace them with production values): LOCAL `http://localhost:3000` (Supabase Docker, `config.toml`), DEV cloud `http://localhost:3001` (`visao-clara-dev`, DEV bucket `visao-clara-docs-dev`), staging Worker `export-documents-worker-staging`.

---

## 0. Status (2026-11-19) and deployment sequence

### Status

| Area | State | How it was established |
|---|---|---|
| Repository checks (`main` at `bf3150a2`) | 129 backend tests pass (73 `_shared`, 39 `_tests`, 17 Worker); `tsc` 0 errors; `eslint` 30 errors / 69 warnings (below the 2026-10-20 baseline) | Local run, 2026-11-19 |
| Security hardening S1, S2, export tokens | Implemented, committed, pushed; deployed to DEV | Git history; tests; DEV validation |
| LOCAL Supabase | All 30 migrations applied | `supabase migration list --local` |
| DEV Supabase (`visao-clara-dev`, London, Postgres 17) | Active. 30/30 migrations; all 10 functions deployed 2026-11-18 with `verify_jwt` matching `config.toml`; R2, OpenAI and export secrets set | Read-only CLI listings, 2026-11-19 |
| DEV validation (owner, 2026-11-18) | Upload, download, deletion on R2; documents ZIP and full ZIP with Excel; Pro/Premium authorisation and Free restrictions; cross-tenant isolation; export token expiry after 5 minutes | Reported by the project owner |
| Cloudflare DEV | Bucket `visao-clara-docs-dev` (EU jurisdiction, private, `r2.dev` disabled, CORS for `http://localhost:3001`); Worker `export-documents-worker-staging` deployed 2026-11-18 | Read-only `wrangler` listings |
| PROD Supabase (`visao-clara-prod`, Ireland, Postgres 17) | **Paused (`INACTIVE`)**, Free plan. **No functions, no secrets**; schema not verifiable while paused (assume empty) | Read-only CLI listings, 2026-11-19 |
| Cloudflare PROD | **No PROD bucket; no production Worker.** `[env.production]` in `wrangler.toml` still has placeholder bucket names and no `jurisdiction` | Read-only `wrangler` listings; repository |
| DNS (one.com) | Apex and `www` point to the one.com parking IP `46.30.211.38`; no HTTPS; **null MX** (`MX 0 .`: the domain receives no mail); no SPF/DMARC. Registration valid until 2027-10-22 | `dig`, `whois`, 2026-11-19 |
| Netlify, Supabase Auth URL/SMTP/Google settings, Google Cloud, OpenAI PROD key | Not verifiable from here; assume **not configured** | n/a |

### Sequence: rehearse on DEV, then repeat on PROD

Never reuse a secret between environments, and always pass `--project-ref` explicitly (the CLI link in `apps/api/supabase/.temp` points at DEV; the same login can reach PROD and unrelated projects).

1. [x] **Repository**: all changes merged on `main`; `deno test --allow-env _shared/` and `deno test --no-lock --allow-env --allow-read=.. --import-map=_tests/import_map.json _tests/` (in `apps/api/supabase/functions`), `npm test` (in the Worker directory), `pnpm exec tsc --noEmit` and `pnpm lint` (in `apps/web`) pass.
2. [x] **DEV database**: all 30 migrations applied.
3. [x] **DEV storage**: private EU bucket `visao-clara-docs-dev`, bucket-scoped token, CORS for `http://localhost:3001`.
4. [x] **DEV secrets**: Edge Function secrets of section 11 with `FILE_STORAGE_PROVIDER=r2` and a DEV-only `EXPORT_JWT_SECRET`.
5. [x] **DEV functions**: all 10 deployed.
6. [x] **DEV Worker**: `export-documents-worker-staging` deployed with its own secrets.
7. [x] **DEV smoke test** with `pnpm dev:cloud` (see the DEV validation row above). Not covered by the rehearsal: email confirmation, password recovery and Google sign-in against a cloud project (they need SMTP and a cloud OAuth client), and very large exports.
8. [ ] **PROD**: resume `visao-clara-prod` (owner), then repeat steps 2-6 against it with a separate PROD bucket, token and Worker (`--env production`) and new secrets. Then Auth, SMTP, Google, Netlify and DNS (sections 2-8, 13).
9. [ ] **PROD smoke test** with two disposable accounts before inviting anyone (section 16), first on `https://<site>.netlify.app`, then on `https://www.visaoclara.pt`.

Answered by the DEV rehearsal: the cloud gateway accepts the frontend's calls to the functions that keep `verify_jwt = true`, and the Worker's server-to-server call to `get-project-expenses-xlsx` works with `verify_jwt = false`. Use the **same API key format on PROD as on DEV** (legacy JWT anon key or publishable key) for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `VC_SUPABASE_ANON_KEY`. Still open: whether very large exports fit the Workers CPU limit of the chosen Cloudflare plan.

### Remaining production launch blockers (from the 2026-11-19 readiness audit)

Nothing below is done. Owner = who acts; changes to code, configuration files, cloud resources and deployments each need explicit approval.

| # | Blocker | Owner | Section |
|---|---|---|---|
| B1 | Supabase PROD is **paused**: resume it (dashboard) and keep it active (Free plan risks) | Owner | 4 |
| B2 | PROD schema: apply the 30 migrations (dry run first) | Owner runs / Claude assists | 12 |
| B3 | No PROD R2 bucket, bucket-scoped token or CORS rule; jurisdiction must be decided **before** creation (EU recommended, as DEV) | Owner | 9 |
| B4 | Production Worker: `wrangler.toml` `[env.production]` needs the real bucket name (twice) and `jurisdiction = "eu"` for an EU bucket; secrets; deploy | Claude (file edit) + Owner (secrets) | 10 |
| B5 | PROD Edge Function secrets (new values, never DEV's) and deployment of all 10 functions | Owner (secrets) + Claude (deploy) | 4, 11 |
| B6 | **Custom SMTP**: provider not chosen ([ADR-0103](../decisions/README.md#adr-0103-transactional-email-provider)); Supabase's built-in mailer only delivers to project team members, so sign-up confirmation and recovery cannot work for real users | Owner | 7 |
| B7 | Netlify site, GitHub connection, manual deploy control, production env vars; DNS records at one.com | Owner | 2, 3 |
| B8 | Supabase Auth URL configuration and a production Google OAuth client and consent screen | Owner | 5, 6 |
| B9 | Legal pages show 25 visible `[A CONFIRMAR: …]` markers (`apps/web/app/privacidade`, `apps/web/app/termos`): entity, NIF, address, contact email, legal bases, processors, transfers, liability, law | Owner / legal adviser (Claude can apply confirmed text) | 15 |
| B10 | A mailbox for the domain (contact/privacy address required by the legal pages): the null MX must be replaced | Owner | 2, 7 |

Needed before launch but not blocking setup: Workers Paid plan for real exports, OpenAI PROD key with budget cap, plans of beta users set (exports need Pro), manual GDPR deletion procedure, PROD backup routine (section 14), links on the login page's legal sentence. After launch: scheduling `cleanup-pending-uploads` (before opening sign-ups widely), error tracking, security headers.

### Manual control of production deploys

No production change happens automatically from a `git push`:

- **Frontend:** Netlify must not publish a push to `main` on its own (section 3, step 5). Each production publish is an explicit owner action and costs 15 of the 300 monthly credits.
- **Edge Functions, Worker, migrations:** deployed only by explicit commands with `--project-ref owmryjakruspyxrwgldx` / `--env production`, after approval. There is no CI.
- Tag every production release in Git (`v1.0.0-beta.N`) so any component can be redeployed from a known version.

---

## 1. Domain registration

- [x] Domain `visaoclara.pt` registered with one.com ([ADR-0101](../decisions/README.md#adr-0101-domain-registrar)); registration valid until 2027-10-22 (`whois`, 2026-11-19).
- [ ] Auto-renewal enabled and the registrant contact details correct at one.com.

**Why:** Auth redirect URLs, the Google consent screen, email sender authentication and user trust all depend on a stable domain.
**Where:** one.com control panel.
**Validate:** `whois visaoclara.pt` shows the registration; one.com shows auto-renew on.
**What can go wrong:** An expired domain breaks login and email for every user.

## 2. DNS configuration

DNS stays at **one.com** and the one.com nameservers (`ns01.one.com`, `ns02.one.com`) stay in place; hosts are connected with records, not by delegating nameservers (portability principle in [ADR-0102](../decisions/0102-initial-hosting-strategy-netlify-free.md#portability-principles)). Netlify DNS is not used.

- [x] Canonical host decided (2026-11-19): **`www.visaoclara.pt`**; the apex redirects to it. Netlify recommends a subdomain as the primary domain with external DNS, because the apex can only point at Netlify's load balancer, not directly at its CDN ([Netlify: configure external DNS](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/), read 2026-11-19).
- [ ] Before the cutover: lower the TTL of the records below at one.com.
- [ ] Records for Netlify, created only **after** the domain is added in Netlify (section 3, step 9), using the exact targets Netlify shows:

  | Host | Type | Target | Replaces |
  |---|---|---|---|
  | `www` | `CNAME` | `<site>.netlify.app` | the `www` `A` record to the one.com parking IP `46.30.211.38` |
  | `@` (apex) | `ALIAS`/`ANAME` if one.com offers it | `apex-loadbalancer.netlify.com` | the apex `A` record to `46.30.211.38` |
  | `@` (apex), fallback | `A` | `75.2.60.5` | (same) |

  Whether one.com offers `ALIAS`/`ANAME` for the apex is unverified; use the `A` record otherwise. Netlify adds the apex automatically when `www` is added (and vice versa), so both records are needed for the redirect and its certificate.
- [ ] Mail records, separate from the website (section 7): a mailbox or forwarding for the domain (the current null MX `MX 0 .` means `visaoclara.pt` receives no mail), and SPF, DKIM and DMARC for the SMTP provider (**TODO**, values come from the provider).

**Why:** Routes users to the frontend and lets mailbox providers trust Auth emails.
**Where:** one.com DNS settings.
**Validate:** `dig +short CNAME www.visaoclara.pt` returns `<site>.netlify.app`; `dig +short visaoclara.pt` returns Netlify's apex target (no longer `46.30.211.38`); Netlify shows both domains as verified; the email provider's domain verification shows "verified".
**What can go wrong:** Missing DKIM/SPF sends confirmation and recovery emails to spam; leftover one.com parking records conflicting with the new ones; long TTLs slow down corrections; Netlify notes DNS changes can take up to a day to be visible.

## 3. Frontend hosting and custom domain (Netlify)

- [x] Hosting provider chosen: Netlify Free ([ADR-0102](../decisions/0102-initial-hosting-strategy-netlify-free.md); compatibility re-verified 2026-11-19: the app uses only App Router, client components, four static Server Components and `next/font/google`, all supported by Netlify's OpenNext adapter).
- [x] Production build succeeds locally (`pnpm build`, 2026-10-21).

**Netlify Free plan** (read on netlify.com on 2026-11-19; prices and limits change, re-check before relying on them):

| Item | Value |
|---|---|
| Monthly credits | 300, **hard limit**; no top-up on Free. When used up, **every project in the team is paused** ("Site not available") until the next cycle |
| Production deploy | 15 credits each (at most 20 per month if nothing else used credits) |
| Compute (server-rendered `/[projectId]/*` routes) | 10 credits per GB-hour |
| Bandwidth | 20 credits per GB |
| Web requests | 2 credits per 10,000 (requests to deploy previews and branch deploys count too) |
| Free of credits | Deploy previews, branch deploys, failed deploys, rollbacks to a previous production deploy |
| Included | Custom domains with HTTPS, functions, basic rate limiting |
| Commercial use | Allowed according to Netlify's Free-plan announcement and staff forum answers; the Self-Serve Subscription Agreement clause was not reviewed, and Netlify may change or end the free tier |
| Escalation | Personal plan, $9/month, 1,000 credits (adds 1-day observability) |

Rough beta estimate (assumption, not measured): about 4 production deploys (60 credits) + about 2 GB bandwidth (40) + under 50,000 requests (10) + some compute: well under 300 credits a month.

Ordered steps (**none executed yet**; all in the Netlify UI by the owner):

1. [ ] **Create a Netlify team** dedicated to Visão Clara (the credit limit and the pause apply to the whole team).
2. [ ] **Connect GitHub**: Add new project → Import an existing project → GitHub. Grant the Netlify GitHub App access to **this repository only**. Production branch `main`.
3. [ ] **Build settings** (monorepo): base directory `apps/web`; build command `pnpm build`; publish directory left to Netlify's Next.js adapter (do not pin the adapter or add `@netlify/plugin-nextjs`; no `netlify.toml` is needed). `apps/web` has its own `pnpm-lock.yaml` and `pnpm-workspace.yaml`.
4. [ ] **Toolchain**: `packageManager: pnpm@10.19.0` is declared only in the root `package.json`, so pin pnpm `10.19.0` and Node (22 LTS; `apps/web` requires ≥ 20.12) with Netlify's build-tool environment variables [verify the names, e.g. `NODE_VERSION`, `PNPM_VERSION`, in Netlify's build docs]. These are not secrets.
5. [ ] **Manual deploy control** (required): a push to `main` must never publish to production by itself. Use Netlify's deploy locking ("Stop auto publishing") so a production deploy goes live only when the owner publishes it, or stop automatic builds and trigger production builds by hand [verify in Netlify's docs which of the two avoids charging 15 credits for builds that are never published]. Turn **off** deploy previews and branch deploys (there are no pull requests; previews would have no valid environment and fail anyway).
6. [ ] **Production environment variables** (scope: **production context only**, never "all contexts"): `NEXT_PUBLIC_APP_ENV=production`, `NEXT_PUBLIC_SUPABASE_URL=https://owmryjakruspyxrwgldx.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (PROD anon/publishable key, same format as DEV), `NEXT_PUBLIC_WORKER_URL` (production Worker, section 10). `apps/web/env-validation.cjs` fails the build if the URL is not the PROD project, a value looks like a secret key, or a Netlify production build is not `production`; a failed build costs no credits.
7. [ ] **First production build** only after PROD Supabase is resumed and migrated and the production Worker URL exists (sections 4, 10, 12). Name the site (it determines `<site>.netlify.app`).
8. [ ] **Test on `https://<site>.netlify.app`**: add this exact origin temporarily to the Supabase Site URL/redirect URLs (section 5), Google OAuth origins (section 6) and R2 CORS (section 9); run the smoke tests (section 16).
9. [ ] **Add the domains** in Netlify → Domain management: add `www.visaoclara.pt` and set it as the **primary domain**; Netlify adds `visaoclara.pt` too and redirects it to the primary. Then create the one.com records (section 2).
10. [ ] **HTTPS**: wait for Netlify to verify DNS and issue the certificate covering both names; check that `http://` redirects to `https://`.
11. [ ] **Switch to the canonical origin** (section "Production URL reference"): Supabase Site URL and redirect URLs (section 5), Google OAuth origin (section 6) and R2 CORS (section 9) use `https://www.visaoclara.pt`; then remove the temporary `netlify.app` entries.
12. [ ] **Validate before inviting beta users**: repeat the smoke tests on `https://www.visaoclara.pt` and check the Netlify usage page after the first days.

**Why:** Netlify serves the static pages from its CDN and renders the dynamic `/[projectId]/*` routes in functions; all data access happens from the browser.
**Where:** Netlify project settings (build, deploys, environment variables, domains). No Netlify-specific code or `netlify.toml` in the repository.
**Validate:** `https://www.visaoclara.pt` loads with a valid certificate; `https://visaoclara.pt` and `http://www.visaoclara.pt` answer 301 to `https://www.visaoclara.pt/`; the browser network tab shows calls only to `owmryjakruspyxrwgldx.supabase.co`, the production Worker and R2; a test push to `main` does not change the live site.
**What can go wrong:** `NEXT_PUBLIC_*` values are compiled in at build time, so changing one needs a new production deploy (15 credits); environment variables scoped to all contexts would give previews production values; exhausting 300 credits **pauses every project in the team**; Netlify may suspend Free usage without cause (migration path in ADR-0102).

## 4. Supabase production project

- [x] Project `visao-clara-prod` (`owmryjakruspyxrwgldx`) created in West EU (Ireland), Postgres 17. Plan: **Free**, for now ([ADR-0104](../decisions/README.md#adr-0104-supabase-production-plan-free-initially)).
- [ ] Resume the project (owner, dashboard). It is paused as of 2026-11-19.
- [ ] Database password stored in a password manager.
- [ ] Note the project URL and API keys (anon/publishable and service-role/secret). Use the same key format as DEV, where the gateway behaviour was validated.
- [ ] Prefer `--project-ref owmryjakruspyxrwgldx` (functions, secrets) and `--db-url` (migrations, dumps) over `supabase link`: the CLI link (`apps/api/supabase/.temp`, tracked) points at DEV and should stay that way.

**Supabase Free plan risks for production** (Supabase docs and pricing page, read 2026-11-19; re-check before relying on them):

| Risk | What it means for Visão Clara | Mitigation (owner) |
|---|---|---|
| **Auto-pause after about one week of low database activity** (paid plans are never paused); Supabase emails a warning before pausing | When paused, the whole app is down for every user: no login, no data, no uploads, no exports. A quiet beta week is enough to trigger it | Check the project status regularly (at least every few days), act on Supabase's pause-warning emails, and resume from the dashboard. Do not rely on artificial "keep-alive" traffic |
| Restoring a paused project is a manual dashboard action, and the restore window is limited (Supabase's pages state different windows) | Recovery is not automatic; a project left paused too long may only be recoverable from a downloaded backup | Resume promptly; keep the manual dumps below |
| **No automatic backups** on Free (daily backups with 7-day retention start on Pro) | A bad migration, an accidental delete or a platform incident cannot be undone from Supabase | Manual `supabase db dump` routine (section 14), before every migration and on a fixed schedule |
| No uptime SLA | Outages are not compensated and may be longer | Accept for the private beta; state it in the beta terms (section 15) |
| Two active Free projects per organisation | DEV and PROD can both be active only while the org's other project (`trainlytics`) stays paused | Keep `trainlytics` paused or move it to another org |
| Free-plan resource quotas (database size, Auth users, Edge Function invocations, egress) | Exceeding them can restrict the project | Check the usage page with the backup routine |
| Built-in mailer delivers only to team members (any plan) | Real users get no confirmation or recovery emails | Custom SMTP (section 7) |

Re-evaluate the plan (upgrade to Pro) when real customer data accumulates, when any pause affects users, or before opening the beta beyond invited users.
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

- [ ] Site URL: `https://www.visaoclara.pt` (use `https://<site>.netlify.app` only while testing before the domain is connected).
- [ ] Redirect URLs (exact, no wildcards): `https://www.visaoclara.pt/auth/callback`, `https://www.visaoclara.pt/auth/reset-password` (plus the same two paths on `https://<site>.netlify.app` until the cutover). The apex is not needed: it redirects to `www` before the app runs, and the app builds every redirect from `window.location.origin`.
- [ ] Do not copy the local `config.toml` Auth settings (`localhost` Site URL) or DEV's URL settings into PROD.
- [ ] "Confirm email" enabled.
- [ ] Minimum password length ≥ 8 (the frontend enforces 8; the server default is lower [verify]).
- [ ] Review Auth rate limits.

**Why:** Supabase only redirects to allow-listed URLs; otherwise it falls back to the Site URL and confirmation/recovery/OAuth flows land on the wrong page.
**Where:** Supabase dashboard → Authentication → URL configuration / Providers / Policies.
**Validate:** Register, confirm and recover a test account; each link lands on the expected page.
**What can go wrong:** Wildcard redirect URLs allow tokens to be sent to unintended hosts (e.g. preview deployments).

## 6. Google OAuth production credentials

- [ ] Google Cloud project owned by a long-lived project account (the local development client lives on the developer's machine and is not suitable for production).
- [ ] OAuth consent screen: app name "Visão Clara", support email, logo (optional), home page `https://www.visaoclara.pt`, privacy policy `https://www.visaoclara.pt/privacidade`, terms `https://www.visaoclara.pt/termos` (published only after the legal text is final, section 15), authorised domain `visaoclara.pt` [verify whether Google also asks for the Supabase domain], scopes `openid`, `email`, `profile`; add beta users as test users, or publish the app.
- [ ] OAuth client (Web application): JavaScript origin `https://www.visaoclara.pt` (plus `https://<site>.netlify.app` while testing); redirect URI `https://owmryjakruspyxrwgldx.supabase.co/auth/v1/callback`. A separate client from the local development one; DEV and PROD never share a client.
- [ ] Client ID and secret entered in Supabase → Authentication → Providers → Google.

**Why:** "Continuar com Google" is a primary sign-in method.
**Validate:** A test user signs in with Google on production; `auth.identities` contains a `google` identity.
**What can go wrong:** `invalid_client` (wrong or missing credentials), `redirect_uri_mismatch` (redirect URI not exactly the Supabase callback), test-user restrictions while the app is in Testing.

## 7. Transactional email provider and SMTP

- [ ] Choose the provider (**TODO**, [ADR-0103](../decisions/README.md#adr-0103-transactional-email-provider); candidates Resend, Brevo — neither integrated).
- [ ] Verify the sending domain (SPF/DKIM/DMARC from step 2), e.g. a sender such as `no-reply@visaoclara.pt` (email uses the bare domain; the website's `www` origin does not affect it).
- [ ] A real mailbox or forwarding for a contact address (for example for privacy requests), replacing the null MX (section 2); the legal pages need it.
- [ ] Enter SMTP host, port, user, password and sender in Supabase → Authentication → SMTP settings.
- [ ] Review the Auth email rate limit after enabling custom SMTP.

**Why:** Supabase's built-in mailer only delivers to members of the project's team and has no delivery guarantee; Supabase says to use custom SMTP beyond testing ([Supabase: custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), read 2026-11-19). Without it, real users never receive confirmation or recovery emails.
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
- [x] DEV bucket `visao-clara-docs-dev`: EU jurisdiction, private, `r2.dev` disabled, CORS origin `http://localhost:3001` only (2026-11-19). It is never used by PROD.
- [ ] Create a **private** production bucket (no public `r2.dev` access), e.g. `visao-clara-docs-prod`.
- [ ] Create an R2 API token scoped to that bucket with object read/write.
- [ ] **Bucket CORS rule.** S2 requires `If-None-Match`; without it the browser's preflight fails and every upload is refused. Only `PUT` is needed: uploads are browser `fetch` calls to presigned URLs, downloads are plain navigations. Use exact origins, no wildcard:

```json
[
  {
    "AllowedOrigins": ["https://www.visaoclara.pt"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "If-None-Match"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

  Add `https://<site>.netlify.app` to the PROD bucket only while testing, then remove it. The apex `https://visaoclara.pt` is not needed (it never serves the app). `http://localhost:3001` belongs on the DEV bucket only. `Content-Length` is signed too but the browser sets it itself, so it needs no CORS entry.
- [ ] Decide the **jurisdiction before creating the bucket** (**TODO**; EU recommended, as for DEV): the jurisdiction cannot be changed later (the Supabase PROD project is in Ireland, and the privacy page lists the storage region). For an EU bucket set `VC_R2_ENDPOINT=https://<account_id>.eu.r2.cloudflarestorage.com` and `jurisdiction = "eu"` on the Worker binding (section 10).
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
- [x] `[env.staging]` (DEV): bucket `visao-clara-docs-dev` with `jurisdiction = "eu"`; deployed 2026-11-18.
- [ ] `[env.production]` in `wrangler.toml`: replace the `R2_BUCKET_NAME` **and** `bucket_name` placeholders (`replace-with-prod-r2-bucket-name`) with the PROD bucket (both identical; the Worker refuses rows that point at any other bucket) and, for an EU bucket, add `jurisdiction = "eu"` to the `[[env.production.r2_buckets]]` binding as in staging (without it the binding looks in the default namespace). `SUPABASE_URL` is already set per environment. This is a configuration-file change and needs approval.
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
| Netlify (production context only) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WORKER_URL`, `NEXT_PUBLIC_APP_ENV=production` |
| Netlify (build tool versions, not secrets) | Node and pnpm versions (section 3, step 4) |
| Supabase Edge Function secrets (`supabase secrets set --project-ref owmryjakruspyxrwgldx` or dashboard) | `VC_SUPABASE_URL`, `VC_SUPABASE_ANON_KEY`, `FILE_STORAGE_PROVIDER=r2`, `VC_R2_ENDPOINT` (required for EU jurisdiction buckets: `https://<account_id>.eu.r2.cloudflarestorage.com`) or `VC_R2_ACCOUNT_ID` (standard buckets), `VC_R2_ACCESS_KEY_ID`, `VC_R2_SECRET_ACCESS_KEY`, `VC_R2_BUCKET`, `VC_R2_REGION` (optional, default `auto`), `OPENAI_API_KEY`, `OPENAI_MODEL`, `EXPORT_JWT_SECRET`. DEV (2026-11-18) uses the endpoint form without `VC_R2_ACCOUNT_ID`/`VC_R2_REGION`; `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform (present in DEV's secret list) |
| Supabase dashboard | Google client ID/secret, SMTP credentials |
| Cloudflare Worker | `SUPABASE_SERVICE_ROLE_KEY`, `EXPORT_JWT_SECRET` (secrets); `SUPABASE_URL`, `STORAGE_PROVIDER`, `S3_REGION` (vars in `wrangler.toml`); `R2_BUCKET` binding |

- [ ] All production secrets are different from local ones **and from DEV**.
- [ ] `VC_SUPABASE_URL` and `VC_SUPABASE_ANON_KEY` are set explicitly as function secrets (the CLI ignores names starting with `SUPABASE_` in env files, and the functions read the `VC_` names).
- [ ] Secrets stored in a password manager with an owner.
- [ ] OpenAI: a dedicated production project/key with a monthly budget limit and alerts.

**Validate:** Search the built frontend bundle for `service_role` and storage key names — no matches.
**What can go wrong:** A secret in `NEXT_PUBLIC_*` is public; reusing local secrets in production.

## 12. Database migrations and RLS validation

- [x] The chain of 30 migrations is applied on DEV (Postgres 17, the same major version as PROD). Note: the local `config.toml` still says `major_version = 15`.
- [ ] PROD must be resumed first. Then, against PROD explicitly (`--db-url` with the PROD connection string typed by the owner, not the DEV-linked project): `supabase db push --dry-run`, review, then `supabase db push` (approval required).
- [ ] `supabase migration list` shows all 30 migrations applied remotely, including `20261106100000_harden_document_files_storage` (S1, removes client INSERT/UPDATE on `document_files`).
- [ ] Take a manual dump (section 14) before every later PROD migration.
- [ ] RLS checks with two accounts in different tenants: B cannot read A's projects, documents, files or expenses; cross-tenant document ids return 404 from `delete-document` and `r2-sign-download`.
- [ ] Plan protection: as a normal user, `update profiles set plan = 'premium'` fails with `42501`; the SQL Editor can change it.

**Why:** Migrations are forward-only; production must match the schema the code expects, and RLS is the only data-isolation layer.
**What can go wrong:** A partially applied migration; editing an old migration instead of adding a new one; assuming local migration state equals production.

## 13. HTTPS and domain verification

- [ ] HTTPS active on `www.visaoclara.pt` **and** `visaoclara.pt` (Netlify certificate covering both; the apex needs it for its redirect).
- [ ] Apex → www redirect: `visaoclara.pt` is Netlify's redirecting domain, `www.visaoclara.pt` the primary.
- [ ] Domain verified for the email provider (step 7) and, if required, for the Google consent screen branding.
- [ ] Supabase Site URL and redirect URLs use `https://www.visaoclara.pt`.

**Validate:** No mixed-content warnings; `curl -I https://www.visaoclara.pt` returns 200 with a valid certificate; `curl -I https://visaoclara.pt` and `curl -I http://www.visaoclara.pt` return 301 with `Location: https://www.visaoclara.pt/`; a path is preserved (`https://visaoclara.pt/termos` → `https://www.visaoclara.pt/termos`).

## 14. Backup and recovery

- [ ] Database: the Free plan has **no automatic backups**. Owner routine: `supabase db dump --db-url <PROD connection string>` (schema, plus `--data-only` for data; the Auth schema is excluded by default [verify which schemas the dump covers]) from a trusted machine, at least weekly during the beta and before every migration. The project must be active (a paused project cannot be dumped). Store dumps encrypted, outside the repository.
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
- [x] `public.debug_auth_context()` is not callable through the API: `20261022100000_explicit_api_grants.sql` revokes it from `PUBLIC`, `anon`, `authenticated` and `service_role` (dropping it is optional).
- [ ] OpenAI budget limit set (step 11).
- [ ] Privacy notice and beta terms final and published at `https://www.visaoclara.pt/privacidade` and `https://www.visaoclara.pt/termos`. The pages exist (`apps/web/app/privacidade`, `apps/web/app/termos`) but show 25 visible `[A CONFIRMAR: …]` markers that the owner or a legal adviser must resolve (entity, NIF, address, contact email, legal bases, email provider, transfer safeguards, liability, applicable law). The processors listed must match reality (Supabase, Cloudflare, OpenAI, Netlify, the email provider), and the terms should reflect the Free-plan availability limits (section 4).
- [ ] The login page's "Ao continuar, aceita os nossos Termos de Serviço e a Política de Privacidade" has no links (the register page has them): small code change, needs approval.
- [ ] Manual procedure for data access/deletion requests (there is no in-app account deletion): delete the user's tenant data, storage prefix `<tenant_id>/`, and the Auth user.

## 16. Smoke tests before inviting beta users

Run on production with dedicated test accounts, first on `https://<site>.netlify.app`, then again on `https://www.visaoclara.pt` after the cutover:

- [ ] Domain: apex and `http://` redirect to `https://www.visaoclara.pt` (section 13); confirmation, recovery and Google links land on `https://www.visaoclara.pt/auth/…`.
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
| Domain | Restore the previous one.com records (keep a copy of them before the cutover) |
| Supabase paused (Free plan) | Resume from the dashboard; tell beta users about the interruption |
| Edge Functions | Check out the previous Git tag and `supabase functions deploy <name>` |
| Worker | Redeploy the previous version (`wrangler rollback` [verify]) |
| Database | **Forward-only**: write a new corrective migration. Restore from backup only as a last resort (loses data written since the backup) |

- [ ] Use expand/contract migrations (add before remove) so the previous frontend keeps working after a migration.
- [ ] Tag releases in Git so functions and Worker can be redeployed from a known version.
- [ ] Incident basics: who is contacted, where logs are (Supabase logs, Worker logs, host logs), how beta users are informed, and how a leaked key is rotated (Supabase keys, R2 token, OpenAI key, `EXPORT_JWT_SECRET`, Google secret).

Open decisions referenced above are tracked in the [documentation index](../README.md#unresolved-questions-and-missing-production-decisions).
