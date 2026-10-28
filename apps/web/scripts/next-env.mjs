// Runs Next.js against ONE explicitly selected Supabase environment:
//
//   node scripts/next-env.mjs <local|dev> <next command> [next args…]
//
//   local -> .env.supabase-local (Supabase Docker)
//   dev   -> .env.supabase-dev   (visao-clara-dev)
//
// The selected file's values override anything inherited from the shell, and every other
// NEXT_PUBLIC_* variable is dropped, so values can never mix between environments.
// Values are never printed.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const require = createRequire(import.meta.url);
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { validateEnvironment } = require('../env-validation.cjs');

const TARGETS = {
  local: { file: '.env.supabase-local', label: 'LOCAL (Supabase Docker)' },
  dev: { file: '.env.supabase-dev', label: 'DEV (visao-clara-dev)' },
};

const [target, command, ...nextArgs] = process.argv.slice(2);
if (!TARGETS[target] || !command) {
  console.error(
    'Choose the Supabase environment explicitly:\n' +
      '  pnpm dev:local    Next.js + Supabase Docker  (http://localhost:3000)\n' +
      '  pnpm dev:cloud    Next.js + visao-clara-dev  (http://localhost:3001)\n' +
      '  pnpm build:local | pnpm build:cloud   production build against the same projects',
  );
  process.exit(1);
}

const { file, label } = TARGETS[target];
const envPath = path.join(appDir, file);
if (!existsSync(envPath)) {
  console.error(`Missing apps/web/${file}. Create it from ${file}.example (see docs/operations/local-development.md).`);
  process.exit(1);
}

const fromFile = parseEnv(readFileSync(envPath, 'utf8'));
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('NEXT_PUBLIC_')));
Object.assign(env, fromFile);

if (env.NEXT_PUBLIC_APP_ENV !== target) {
  console.error(`${file} must set NEXT_PUBLIC_APP_ENV=${target}.`);
  process.exit(1);
}

try {
  validateEnvironment({ env, appDir, isDevServer: command === 'dev' });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

console.log(`next ${command} -> Supabase ${label} (${file})`);

const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), command, ...nextArgs], {
  cwd: appDir,
  env,
  stdio: 'inherit',
});
// Ctrl+C reaches the whole process group; let Next.js shut down and mirror its exit status.
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
