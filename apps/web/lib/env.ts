// Which Supabase environment this build talks to (validated at startup by env-validation.cjs).
// Must be read as process.env.NEXT_PUBLIC_APP_ENV literally so Next.js inlines it.
export type AppEnv = 'local' | 'dev' | 'production';

export const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV as AppEnv | undefined;

/**
 * Name for browser-persisted state (localStorage). LOCAL and DEV already run on different
 * origins (ports 3000 / 3001); DEV keys are also suffixed so the two can never read each
 * other's data even on the same origin. LOCAL and production keep their historical names.
 */
export function storageKeyForEnv(name: string): string {
  return APP_ENV === 'dev' ? `${name}:dev` : name;
}
