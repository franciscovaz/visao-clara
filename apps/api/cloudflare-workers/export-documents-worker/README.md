# Export Documents Worker

Cloudflare Worker for streaming ZIP export of project documents.

## Architecture

1. Supabase Edge Function (`authorize-project-documents-export`) signs a short-lived JWT
2. Frontend calls Worker with the JWT token
3. Worker validates JWT and fetches document metadata from Supabase
4. Worker pre-validates all files exist in storage
5. Worker streams files from R2/S3 into a ZIP archive
6. ZIP is streamed directly to browser without buffering

## Setup

### Prerequisites

- Node.js 18+
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account with Workers Unbound (paid tier required for large exports)

### Local Development with MinIO

1. Start MinIO (if not already running):
   ```bash
   # Using Docker
   docker run -d -p 9000:9000 -p 9001:9001 \
     -e MINIO_ROOT_USER=minioadmin \
     -e MINIO_ROOT_PASSWORD=minioadmin \
     minio/minio server /data --console-address ":9001"
   ```

2. Create `.dev.vars` file (gitignored):
   ```bash
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
   EXPORT_JWT_SECRET=your-local-jwt-secret
   STORAGE_PROVIDER=s3
   S3_ENDPOINT_URL=http://127.0.0.1:9000
   S3_ACCESS_KEY_ID=minioadmin
   S3_SECRET_ACCESS_KEY=minioadmin
   S3_REGION=us-east-1
   S3_BUCKET=visao-clara-docs
   ```

3. Start the worker:
   ```bash
   cd apps/api/cloudflare-workers/export-documents-worker
   wrangler dev --env development
   ```

4. Test the worker:
   ```bash
   # First get a token from the Supabase Edge Function
   curl -X POST http://localhost:54321/functions/v1/authorize-project-documents-export \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"project_id": "PROJECT_ID"}'

   # Then call the worker with the token
   curl "http://localhost:8787/?token=YOUR_EXPORT_TOKEN" \
     --output test-export.zip
   ```

### Tests

```bash
npm test    # deno test --no-check --no-lock --allow-env test/   (needs Deno)
```

Runs the real Worker code against an in-memory Supabase REST table and a mock R2 binding (no network, no
cloud). Covers invalid, expired, forged, wrong-scope and malformed tokens (nothing is read), cross-tenant
isolation, inconsistent storage metadata (409), ZIP contents and the spreadsheet hop of a full export.

### Deployment (DEV rehearsal first, then production)

Environments in `wrangler.toml`: `development` (local `wrangler dev`, local S3), `staging` (DEV cloud project)
and `production`. Before deploying an environment:

1. Replace the `R2_BUCKET_NAME` and `bucket_name` placeholders (`replace-with-…-r2-bucket-name`) with that
   environment's private bucket (both identical). `SUPABASE_URL` is already set per environment.
2. Set the two secrets (`SUPABASE_URL` is a plain var, not a secret):
   ```bash
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging   # or production
   wrangler secret put EXPORT_JWT_SECRET --env staging           # same value as the Edge Function secret
   ```
3. Check the bundle without deploying: `npx wrangler deploy --dry-run --env staging`.
4. Deploy (needs approval): `npm run deploy:staging` or `npm run deploy` (production).
5. Put the Worker URL in `NEXT_PUBLIC_WORKER_URL` of the frontend (compiled into the build).

The full list of requirements (functions, secrets, CORS of the bucket, `verify_jwt` of
`get-project-expenses-xlsx`, DEV-to-PROD sequence) is in `docs/operations/production-setup.md`, sections 0, 4, 9
and 10.

## Security

- JWT tokens expire after 5 minutes
- Tokens are signed with HS256 using a shared secret
- Service role key is only used in the Worker (server-side)
- Tenant isolation is enforced explicitly in Worker queries
- No R2 credentials are exposed to the frontend

## Service Role Key Usage

The Worker uses the Supabase service role key to bypass RLS when fetching document metadata. This is necessary because the Worker is not a Supabase user. To maintain security:

- Service role key is stored as a Cloudflare secret (never in code)
- Worker explicitly filters by `tenant_id` and `project_id` from JWT payload
- Service role key is only used for reads, never writes
- Tokens are verified with HS256 only, and their `project_id`/`tenant_id`/`user_id` must be UUIDs and the scope one this Worker serves (`../../../supabase/functions/_shared/export_access.ts`)
- Worker is a trusted backend component

## Cloudflare Workers Limits

The ZIP is streamed (no buffering), but zip.js computes a CRC32 over every byte, so CPU time grows with the
export size, and long exports need a long wall time. Use the **Workers Paid** plan for real exports; check
Cloudflare's current limits before launch (the Free plan's CPU limit is far too small).

## Troubleshooting

### Worker cannot reach MinIO locally

Ensure MinIO is running and accessible:
```bash
curl http://127.0.0.1:9000/minio/health/live
```

If using Docker, ensure port mapping is correct.

### JWT validation fails

Check that:
- `EXPORT_JWT_SECRET` matches between Edge Function and Worker
- Token is not expired (5 minute window)
- Token issuer/audience match (an invalid or expired token returns 401 `INVALID_TOKEN`; a token with another scope returns 403 `INVALID_SCOPE`)

### Files not found in storage

Check that:
- `storage_key` or `r2_key` is set in `document_files` table
- Files have status `uploaded`
- Storage backend configuration is correct

### ZIP generation fails

Check Worker logs for specific errors. Common issues:
- Missing files (pre-validation should catch this)
- Storage connectivity issues
- Memory limits (unlikely with streaming)


## Validação de metadados de armazenamento

O Worker lê com o service role e por isso não confia nas colunas de `document_files`: cada chave tem de estar
sob `<tenant>/<projeto>/<documento>/<ficheiro>/` da própria linha, e o provider/bucket da linha têm de ser os
que este Worker serve (`STORAGE_PROVIDER=s3` serve linhas `local_s3` com `S3_BUCKET`; `STORAGE_PROVIDER=r2`
serve linhas `r2` com `R2_BUCKET_NAME`, o nome do bucket ligado a `R2_BUCKET`). Qualquer linha incoerente
cancela a exportação com `409 STORAGE_LOCATION_UNTRUSTED`. Em produção (R2) é obrigatório definir
`R2_BUCKET_NAME` em `wrangler.toml`. O caminho R2 (binding) foi exercitado localmente em 2026-11-16 com
`wrangler dev --local` (bucket R2 simulado): ZIP com ficheiro de 3 MB e folha de cálculo idênticos byte a byte.
Não foi testado contra um bucket R2 real.
