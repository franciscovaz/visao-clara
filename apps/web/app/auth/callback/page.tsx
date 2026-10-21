'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { supabase, getAuthRedirectInfo } from '@/lib/supabase/client';
import { ProfileService } from '@/src/services/profileService';

// Landing page for Google OAuth and email-confirmation links (signUp emailRedirectTo).
// auth-js turns the link into a session while the client initializes.

type CallbackState =
  | { phase: 'working'; message: string }
  | { phase: 'error'; message: string; canRetry: boolean };

function redirectErrorMessage(errorCode: string | null): string {
  switch (errorCode) {
    case 'otp_expired':
      return 'A ligação expirou ou já foi utilizada. Inicie sessão para receber um novo email de confirmação.';
    case 'access_denied':
      return 'O início de sessão foi cancelado ou não foi autorizado.';
    default:
      return 'Não foi possível concluir a autenticação. Tente novamente.';
  }
}

export default function AuthCallback() {
  const router = useRouter();
  const [state, setState] = useState<CallbackState>({ phase: 'working', message: 'A validar a sua sessão...' });

  // Incremented by "Tentar novamente" to re-run the sign-in completion
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    const update = (next: CallbackState) => {
      if (!ignore) setState(next);
    };

    const completeSignIn = async () => {
      const redirectInfo = getAuthRedirectInfo();

      try {
        // Resolves after auth-js has processed the link in the URL
        const { data: { session }, error } = await supabase.auth.getSession();

        // A failed link (expired, reused, cancelled OAuth) wins over any existing session
        if (redirectInfo.hasError) {
          update({ phase: 'error', message: redirectErrorMessage(redirectInfo.errorCode), canRetry: false });
          return;
        }
        if (error || !session) {
          update({ phase: 'error', message: redirectErrorMessage(null), canRetry: false });
          return;
        }

        update({
          phase: 'working',
          message: redirectInfo.type === 'signup'
            ? 'Email confirmado. A preparar a sua conta...'
            : 'Sessão iniciada. A preparar a sua conta...',
        });

        try {
          await ProfileService.resumePendingOnboarding();
        } catch (onboardingError) {
          console.error('Auth callback: onboarding completion failed', onboardingError instanceof Error ? onboardingError.message : onboardingError);
          update({
            phase: 'error',
            message: 'Sessão iniciada, mas não foi possível criar o seu projeto. Tente novamente.',
            canRetry: true,
          });
          return;
        }

        const redirectUrl = await ProfileService.getPostLoginRedirect();
        if (ignore) return;
        if (!redirectUrl) {
          update({
            phase: 'error',
            message: 'Sessão iniciada, mas não foi possível carregar os seus projetos. Tente novamente.',
            canRetry: true,
          });
          return;
        }
        router.replace(redirectUrl);
      } catch (err) {
        console.error('Auth callback error:', err instanceof Error ? err.message : err);
        update({ phase: 'error', message: redirectErrorMessage(null), canRetry: true });
      }
    };

    completeSignIn();
    return () => {
      ignore = true;
    };
  }, [router, attempt]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="text-center max-w-md">
        {state.phase === 'working' ? (
          <>
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-900 mb-2">{state.message}</h1>
            <p className="text-sm text-slate-600">Aguarde um momento.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900 mb-4">{state.message}</h1>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {state.canRetry && (
                <Button
                  onClick={() => {
                    setState({ phase: 'working', message: 'A tentar novamente...' });
                    setAttempt((n) => n + 1);
                  }}
                >
                  Tentar novamente
                </Button>
              )}
              <Button variant="secondary" onClick={() => router.replace('/login')}>
                Voltar ao login
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
