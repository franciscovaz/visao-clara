# ADR-0102: Initial Hosting Strategy — Netlify Free

- **Status:** Accepted (initial choice; not yet deployed)
- **Date:** 2026-10-22
- **Supersedes:** the "Frontend hosting" placeholder previously listed as Proposed in the [ADR index](README.md)

_Last reviewed: 2026-10-22_

## Context

Visão Clara is preparing a private beta for about 5–20 invited users. Only the frontend (`apps/web`, Next.js 16.1.1 / React 19) needs a host; Supabase (Auth, Postgres, Edge Functions), Cloudflare R2 and the export Worker are separate services.

Goals for the first hosting choice:

- €0/month during the beta.
- Terms that allow future commercial use (no rehosting when the first customer pays).
- Serve the app on the production domain `visaoclara.pt` (registered with one.com) from the testing phase.
- No vendor lock-in; migrating to Vercel or DigitalOcean must stay straightforward.

### Compatibility audit (2026-10-22)

Audited files: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/pnpm-workspace.yaml`, root `package.json` / `pnpm-workspace.yaml`, `apps/web/app/layout.tsx`, `apps/web/lib/supabase/client.ts`, `apps/web/app/login/page.tsx`, `apps/web/app/register/page.tsx`, `apps/web/app/auth/forgot-password/page.tsx`, `apps/web/.env.local.example`, `apps/api/cloudflare-workers/export-documents-worker/wrangler.toml`.

| # | Area | Finding | Classification |
|---|---|---|---|
| 1 | Next.js 16 on Netlify | Netlify deploys Next.js through its OpenNext-based adapter, applied automatically, and announced zero-configuration support for Next.js 16 ([changelog](https://www.netlify.com/changelog/next-js-16-deploy-on-netlify.md), [docs](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)). The app uses `next/font/google` (`app/layout.tsx`), no `next/image`, no custom `next.config.ts` options. | **Compatible** |
| 2 | Monorepo build | `apps/web` is self-contained: own `pnpm-lock.yaml` and its own `pnpm-workspace.yaml` (`packages: [.]`). The root `pnpm-workspace.yaml` lists `apps/*` but the root has no lockfile or dependencies. Netlify needs base directory `apps/web` and build command `pnpm build`; the publish directory is set by the adapter. | **Requires configuration** |
| 2a | pnpm / Node versions | `packageManager: pnpm@10.19.0` is declared only in the **root** `package.json`; `apps/web/package.json` has no `packageManager` or `engines`. No `.nvmrc`/`.node-version`. The pnpm and Node versions Netlify uses for base directory `apps/web` must be confirmed and pinned via Netlify environment variables (e.g. `NODE_VERSION`, `PNPM_VERSION`) [verify variable names in Netlify docs]. | **Unknown / needs verification** |
| 3 | Server-side features | No `middleware.ts`/`proxy.ts`, no route handlers (`app/api`), no Server Actions, no `next/headers`/`cookies()`; every page is a client component. Static routes are served from the CDN; dynamic `/[projectId]/*` routes are server-rendered by functions (cost: compute and web requests). Node dependencies are browser libraries (`@supabase/supabase-js`, `zustand`, icons). | **Compatible** |
| 4 | Supabase Auth callbacks | Redirects are built from `window.location.origin` (`/auth/callback`, `/auth/reset-password`), so they follow whatever host serves the app. Supabase Site URL/redirect allowlist and the Google OAuth client must list the Netlify test URL and `visaoclara.pt`. Deploy-preview URLs change per deploy and must not be added with wildcards. | **Requires configuration** |
| 5 | Production environment variables | Exactly three, all build-time `NEXT_PUBLIC_*`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WORKER_URL` (`apps/web/.env.local.example`). Must be scoped to the production context so deploy previews do not run against production. | **Requires configuration** |
| 6 | R2 and Worker | Host-independent. The browser uploads/downloads with presigned URLs and opens the Worker URL directly. The R2 bucket CORS rule must allow the Netlify test origin and `https://visaoclara.pt`. | **Requires configuration** (outside Netlify) |
| 7 | Netlify Free limits | 300 credits/month, **hard limit**; when exhausted **all projects on the team are paused** until the next cycle. Production deploy 15 credits, bandwidth 20 credits/GB, compute 10 credits/GB-hour, web requests 2 credits/10,000; deploy previews, branch deploys and failed deploys cost 0 ([how credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), [pricing](https://www.netlify.com/pricing/), retrieved 2026-10-22). The credits alone allow at most 20 production deploys per month. | **Requires configuration** (deploy discipline, usage monitoring) |
| 7a | Commercial use on Free | Netlify staff state in the community forum that the Free plan may be used commercially (reselling hosting is not allowed) ([forum](https://answers.netlify.com/t/can-we-use-netlify-free-plan-for-commercial-purposes/41545)); the Terms of Use were not reviewed. The Self-Serve Subscription Agreement allows either party to terminate Free usage without cause ([agreement](https://www.netlify.com/legal/self-serve-subscription-agreement/)). | **Unknown / needs verification** |
| 8 | Lock-in | Nothing Netlify-specific exists in the repository. The adapter is applied at build time without code changes. Optional `netlify.toml` would contain build settings only. | **Compatible** |

**Blockers:** none found. The decision below is therefore confirmed, subject to the open verifications (2a, 7a).

## Decision

Host `apps/web` on **Netlify Free** for the private beta, serving `visaoclara.pt` with DNS kept at one.com. Treat it as an initial, reversible choice.

## Alternatives considered

| Option | Advantages | Trade-offs / why not now |
|---|---|---|
| **Vercel Hobby / Pro** | Built by the Next.js team; best native Next.js integration and developer experience; preview deployments | Hobby is limited to non-commercial personal use; commercial use needs Pro (per-seat monthly price [verify]). Fails the €0 + commercial-use goal. |
| **DigitalOcean App Platform** | Predictable container-based Node.js hosting; infrastructure flexibility; standard `next start` | Static sites can be free, but a dynamic Next.js app needs paid compute [verify current prices]. Fails the €0 goal. |
| **Railway** | Simple container/Node deployments, usage-based pricing | No permanent free tier for an always-on service [verify]; fails the €0 goal. |
| **Cloudflare Workers** (OpenNext Cloudflare adapter) | Same vendor as R2 and the export Worker; generous free tier [verify] | Requires an adapter and Workers-specific configuration; Next.js 16 compatibility and Worker size limits on the free plan need verification [verify]; more deployment-specific setup than Netlify. |

## Future migration options

- **Vercel Pro** — preferred alternative when native Next.js integration and developer experience become priorities. Requires a paid plan for commercial use.
- **DigitalOcean App Platform** — alternative when predictable Node.js hosting and infrastructure flexibility become priorities. Dynamic Next.js applications require paid compute.
- **Staying on Netlify** — remains valid if the platform continues to meet technical, commercial and cost requirements (including a paid Netlify plan if credits become limiting).

Migration work, if needed: create the project on the new host (base directory `apps/web`, `pnpm build`), copy the three `NEXT_PUBLIC_*` variables, deploy and test on the provider URL, update DNS records at one.com, then update the Supabase redirect allowlist, Google OAuth origins and R2 CORS for any new test origin.

## Portability principles

- Prefer standard Next.js APIs; do not use Netlify-only runtime features (Netlify Functions, Edge Functions, Blobs, Forms, Identity) for application logic.
- Avoid Netlify-specific business logic.
- Keep Supabase and R2 independent of the hosting provider.
- Manage the domain and DNS at one.com; point records to the host rather than delegating nameservers.
- Keep deployment configuration (dashboard settings or an optional `netlify.toml`) separate from application code.
- Document every required environment variable by name (`apps/web/.env.local.example`) without exposing values.

## Migration triggers

Re-evaluate the hosting provider when:

- free-tier limits (credits) become restrictive or a pause occurs;
- the first paying customers arrive;
- performance or reliability requirements change;
- platform-specific compatibility issues emerge (e.g. a Next.js upgrade not yet supported by the adapter);
- another provider offers a materially better cost/benefit ratio.

## Consequences and risks

**Positive**

- €0 hosting during the beta, with custom domain and HTTPS included on the Free plan.
- No application code changes; deployment uses the standard Next.js build.
- Deploy previews and branch deploys do not consume credits.
- DNS stays at one.com, so changing hosts is a DNS update.

**Negative / risks**

- **Hard credit cap:** exhausting 300 credits pauses **every** project on the team ("Site not available") until the next billing cycle — a full outage for beta users. At 15 credits per production deploy, deploying on every commit to `main` can consume the budget quickly.
- **Service suspension:** Free usage can be terminated by Netlify without cause.
- **Commercial-use terms** need confirmation in the Terms of Use before charging customers.
- **Server-rendered dynamic routes** (`/[projectId]/*`) consume compute and requests; usage must be monitored.
- **Toolchain versions** (Node, pnpm) must be pinned in Netlify settings to match local development.
- **Community reports** describe deploys blocked by stale credit flags on the Free plan ([example](https://answers.netlify.com/t/free-plan-shows-run-out-of-credits-but-30-30-credits-available-production-deploys-blocked/165662)) — user reports, not confirmed by Netlify.

Mitigations: deploy production only for releases (not every commit), watch the credit dashboard, keep a documented migration path (above), and keep the Personal plan (paid, 1,000 credits per Netlify's pricing page) as an escalation option.

## Next steps (not executed)

The ordered deployment checklist lives in [production setup — step 3](../operations/production-setup.md#3-frontend-hosting-and-custom-domain-netlify).
