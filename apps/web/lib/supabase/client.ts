import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. ' +
    'Please create a .env.local file in apps/web/ with:\n' +
    'NEXT_PUBLIC_SUPABASE_URL=your_supabase_url\n' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key'
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Please create a .env.local file in apps/web/ with:\n' +
    'NEXT_PUBLIC_SUPABASE_URL=your_supabase_url\n' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ---------------------------------------------------------------------------
// Password recovery
//
// auth-js parses the recovery link (#access_token=…&type=recovery) while the
// client initializes and emits PASSWORD_RECOVERY exactly once, from a
// setTimeout. A listener registered by a page can miss it, so it is captured
// here, at module load. Only that event marks a session as a recovery session;
// a normal signed-in session never grants access to the reset form.
// ---------------------------------------------------------------------------

export const PASSWORD_RESET_PATH = '/auth/reset-password';

export type RecoveryState =
  | { status: 'none' }      // not opened from a recovery link
  | { status: 'pending' }   // recovery link detected, waiting for auth-js
  | { status: 'ready'; userId: string }
  | { status: 'invalid' };  // expired, used or malformed link

let recoveryState: RecoveryState = { status: 'none' };
const recoveryListeners = new Set<(state: RecoveryState) => void>();

function setRecoveryState(next: RecoveryState) {
  recoveryState = next;
  recoveryListeners.forEach((listener) => listener(next));
}

export function getRecoveryState(): RecoveryState {
  return recoveryState;
}

export function onRecoveryStateChange(listener: (state: RecoveryState) => void): () => void {
  recoveryListeners.add(listener);
  return () => {
    recoveryListeners.delete(listener);
  };
}

/** Ends the recovery session state (after a successful reset or sign-out). */
export function clearRecoveryState() {
  setRecoveryState({ status: 'none' });
}

if (typeof window !== 'undefined') {
  // Read the link before auth-js clears it from the URL (it does so asynchronously).
  // Only flags are read here; tokens are never stored or logged.
  if (window.location.pathname === PASSWORD_RESET_PATH) {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    const hasError = ['error', 'error_code', 'error_description'].some(
      (key) => hash.has(key) || query.has(key),
    );

    if (hasError) {
      recoveryState = { status: 'invalid' };
    } else if (hash.get('type') === 'recovery' && hash.has('access_token')) {
      recoveryState = { status: 'pending' };
      // initialize() resolves with the URL-parsing result. On success auth-js has
      // already queued PASSWORD_RECOVERY; on failure no event follows.
      supabase.auth.initialize().then(({ error }) => {
        if (error && recoveryState.status === 'pending') {
          setRecoveryState({ status: 'invalid' });
        }
      });
    }
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session?.user) {
      setRecoveryState({ status: 'ready', userId: session.user.id });
    } else if (event === 'SIGNED_OUT' && recoveryState.status === 'ready') {
      setRecoveryState({ status: 'none' });
    }
  });
}
