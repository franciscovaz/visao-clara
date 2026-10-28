import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Shared with scripts/next-env.mjs. CommonJS so it loads on any Node version used to build.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateEnvironment } = require("./env-validation.cjs") as {
  validateEnvironment: (options: {
    env?: NodeJS.ProcessEnv;
    appDir: string;
    isDevServer?: boolean;
  }) => void;
};

export default function nextConfig(phase: string): NextConfig {
  // Fail fast on a missing, mixed or wrong Supabase environment (values are never printed)
  validateEnvironment({
    env: process.env,
    appDir: __dirname,
    isDevServer: phase === PHASE_DEVELOPMENT_SERVER,
  });

  return {};
}
