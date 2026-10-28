/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS on purpose: loaded by next.config.ts on any Node version */
'use strict';

// Decides whether the web app may run against the configured Supabase project.
// Used by next.config.ts (every `next dev`, `next build` and `next start`, including Netlify and CI)
// and by scripts/next-env.mjs (`pnpm dev:local` / `dev:cloud`). Messages name variables and expected
// hosts only; values are never printed.

const fs = require('node:fs');
const path = require('node:path');

// Public project references (not secrets: they are part of every API URL).
const SUPABASE_PROJECT_REFS = {
  dev: 'xqdsxkmtzkccnbdiuzhn', // visao-clara-dev
  production: 'owmryjakruspyxrwgldx', // visao-clara-prod
};
const APP_ENVS = ['local', 'dev', 'production'];
const LOCAL_HOSTS = ['127.0.0.1', 'localhost'];

// Files Next.js loads on its own. Any of them could silently fill in values missing from the
// selected environment, so none may exist in apps/web.
const AUTO_LOADED_ENV_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.development.local',
  '.env.production',
  '.env.production.local',
  '.env.test',
  '.env.test.local',
];

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function looksSecret(value) {
  if (value.startsWith('sb_secret_') || /^sk-[A-Za-z0-9_-]{10,}/.test(value)) return true;
  const payload = decodeJwtPayload(value);
  return Boolean(payload && payload.role === 'service_role');
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Throws an Error listing every problem found.
 * @param {{ env?: Record<string, string | undefined>, appDir: string, isDevServer?: boolean }} options
 */
function validateEnvironment({ env = process.env, appDir, isDevServer = false }) {
  const problems = [];

  const autoLoaded = AUTO_LOADED_ENV_FILES.filter((name) => fs.existsSync(path.join(appDir, name)));
  if (autoLoaded.length > 0) {
    problems.push(
      `Remove ${autoLoaded.join(', ')} from apps/web: Next.js loads these automatically and could mix ` +
        'values between environments. Use .env.supabase-local / .env.supabase-dev via pnpm dev:local / dev:cloud.',
    );
  }

  const appEnv = env.NEXT_PUBLIC_APP_ENV;
  if (!APP_ENVS.includes(appEnv)) {
    problems.push(
      `NEXT_PUBLIC_APP_ENV must be one of ${APP_ENVS.join(', ')} (it is ${appEnv ? 'set to an unknown value' : 'not set'}). ` +
        'Start the app with pnpm dev:local or pnpm dev:cloud.',
    );
    return fail(problems);
  }

  // The Supabase URL must be exactly the project of the selected environment.
  const url = parseUrl(env.NEXT_PUBLIC_SUPABASE_URL || '');
  if (!url) {
    problems.push('NEXT_PUBLIC_SUPABASE_URL is missing or not a valid URL.');
  } else if (appEnv === 'local') {
    if (!LOCAL_HOSTS.includes(url.hostname)) {
      problems.push('NEXT_PUBLIC_APP_ENV=local requires NEXT_PUBLIC_SUPABASE_URL on 127.0.0.1 or localhost (Supabase Docker).');
    }
  } else {
    const expectedHost = `${SUPABASE_PROJECT_REFS[appEnv]}.supabase.co`;
    if (url.protocol !== 'https:' || url.hostname !== expectedHost) {
      problems.push(`NEXT_PUBLIC_APP_ENV=${appEnv} requires NEXT_PUBLIC_SUPABASE_URL=https://${expectedHost}.`);
    }
  }

  // A development server never talks to the production project.
  if (isDevServer && appEnv === 'production') {
    problems.push('A development server must not use the production Supabase project (NEXT_PUBLIC_APP_ENV=production).');
  }

  // A Netlify production deploy must be built for production (other contexts and local/CI builds are free).
  if (env.NETLIFY === 'true' && env.CONTEXT === 'production' && appEnv !== 'production') {
    problems.push('Netlify production deploys require NEXT_PUBLIC_APP_ENV=production.');
  }

  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!anonKey) {
    problems.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing (use the anon / publishable key of the selected project).');
  } else if (appEnv !== 'local') {
    // Legacy JWT keys carry the project reference; publishable keys (sb_publishable_…) do not.
    const payload = decodeJwtPayload(anonKey);
    if (payload && payload.ref && payload.ref !== SUPABASE_PROJECT_REFS[appEnv]) {
      problems.push('NEXT_PUBLIC_SUPABASE_ANON_KEY belongs to a different Supabase project.');
    }
  }

  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith('NEXT_PUBLIC_') && value && looksSecret(value)) {
      problems.push(`${name} contains a secret key. NEXT_PUBLIC_* values are sent to the browser; use the anon/publishable key only.`);
    }
  }

  const workerUrl = env.NEXT_PUBLIC_WORKER_URL;
  if (workerUrl) {
    const worker = parseUrl(workerUrl);
    if (!worker) {
      problems.push('NEXT_PUBLIC_WORKER_URL is not a valid URL.');
    } else if (appEnv === 'local' && !LOCAL_HOSTS.includes(worker.hostname)) {
      problems.push('NEXT_PUBLIC_APP_ENV=local requires a local NEXT_PUBLIC_WORKER_URL (127.0.0.1 or localhost).');
    } else if (appEnv !== 'local' && worker.protocol !== 'https:') {
      problems.push(`NEXT_PUBLIC_WORKER_URL must use https for ${appEnv}.`);
    }
  }

  return fail(problems);
}

function fail(problems) {
  if (problems.length > 0) {
    const error = new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
    error.name = 'EnvironmentConfigError';
    throw error;
  }
}

module.exports = { validateEnvironment, SUPABASE_PROJECT_REFS, AUTO_LOADED_ENV_FILES };
