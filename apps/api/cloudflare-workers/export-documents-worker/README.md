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

### Production Deployment

1. Configure production secrets in Cloudflare dashboard or via wrangler:
   ```bash
   wrangler secret put SUPABASE_URL --env production
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
   wrangler secret put EXPORT_JWT_SECRET --env production
   ```

2. Deploy:
   ```bash
   wrangler deploy --env production
   ```

3. Note the deployed worker URL for frontend integration.

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
- Worker is a trusted backend component

## Cloudflare Workers Limits

- **CPU Time**: 30ms per request (Workers Unbound)
- **Wall Time**: Up to 30 minutes (Workers Unbound required)
- **Memory**: 128MB
- **Response Size**: No limit (streaming)

Workers Unbound paid tier is required for exports larger than ~50MB due to wall time limits.

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
- Token issuer/audience match

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
