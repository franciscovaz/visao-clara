'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { AuthShell, AuthMessage, AuthDivider, AuthLink, AuthLegalNotice } from '@/components/AuthShell';
import { useAuthStore } from '@/src/store/authStore';
import { ProfileService } from '@/src/services/profileService';
import { supabase } from '../../lib/supabase/client';

function signInErrorMessage(err: unknown): string {
  const error = (err ?? {}) as { status?: number; code?: string; name?: string };
  switch (error.code) {
    case 'invalid_credentials':
      return 'Email ou palavra-passe incorretos.';
    case 'email_not_confirmed':
      return 'Ainda não confirmou o seu email. Abra a ligação que lhe enviámos ou peça um novo email de confirmação.';
    case 'user_banned':
      return 'Não é possível iniciar sessão com esta conta. Contacte-nos para mais informações.';
  }
  if (error.status === 429) {
    return 'Demasiadas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (error.status === 0 || error.name === 'AuthRetryableFetchError') {
    return 'Não foi possível ligar ao servidor. Verifique a sua ligação e tente novamente.';
  }
  return 'Não foi possível iniciar sessão. Tente novamente.';
}

export default function Login() {
  const router = useRouter();
  const { signIn, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const busy = loading || isSubmitting;

  const handleGoogleLogin = async () => {
    try {
      setError('');
      setNotice('');

      // Pending onboarding answers are persisted (appContextStore) and resumed by /auth/callback
      const redirectUrl = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        throw error;
      }
      
      // OAuth will redirect to Google, then back to callback
      // The callback will handle the post-auth flow
    } catch (err) {
      console.error('Google OAuth error:', err instanceof Error ? err.message : err);
      setError('Não foi possível iniciar sessão com o Google. Tente novamente.');
    }
  };

  const handleEmailLogin = async () => {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Preencha o email e a palavra-passe.');
      return;
    }

    setError('');
    setNotice('');
    setUnconfirmedEmail(null);
    setIsSubmitting(true);
    try {
      try {
        await signIn(email.trim(), password);
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === 'email_not_confirmed') {
          setUnconfirmedEmail(email.trim());
        }
        setError(signInErrorMessage(err));
        return;
      }

      // Finish onboarding answered before sign-in (if any); existing accounts are untouched
      try {
        await ProfileService.resumePendingOnboarding();
      } catch (onboardingError) {
        console.error('Onboarding completion failed:', onboardingError instanceof Error ? onboardingError.message : onboardingError);
        setError('Sessão iniciada, mas não foi possível criar o seu projeto. Tente novamente.');
        return;
      }

      // Redirect to the user's project, or onboarding when they have none
      const redirectUrl = await ProfileService.getPostLoginRedirect();
      if (!redirectUrl) {
        setError('Sessão iniciada, mas não foi possível carregar os seus projetos. Tente novamente.');
        return;
      }
      router.push(redirectUrl);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail || isResending) return;
    setIsResending(true);
    setError('');
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: unconfirmedEmail,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (resendError && resendError.status === 429) {
        setError('Já pediu um email recentemente. Aguarde alguns minutos antes de pedir outro.');
        return;
      }
      if (resendError) {
        console.error('Resend confirmation failed:', resendError.status, resendError.code);
        setError('Não foi possível enviar o email. Tente novamente mais tarde.');
        return;
      }
      setUnconfirmedEmail(null);
      setNotice('Se a conta ainda não estiver confirmada, enviámos um novo email de confirmação.');
    } catch {
      setError('Não foi possível enviar o email. Verifique a sua ligação e tente novamente.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthShell
      title="Bem-vindo ao Visão Clara"
      description="Inicie sessão para guardar o seu projeto e aceder-lhe em qualquer dispositivo"
      footer={<AuthLegalNotice />}
    >
      <div className="space-y-6">
        {(error || notice) && (
          <div className="space-y-3">
            {error && (
              <AuthMessage tone="error">
                <p>{error}</p>
                {unconfirmedEmail && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResending}
                    className="mt-2 cursor-pointer rounded font-medium text-blue-600 outline-none hover:text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    {isResending ? 'A enviar...' : 'Reenviar email de confirmação'}
                  </button>
                )}
              </AuthMessage>
            )}
            {notice && <AuthMessage tone="success">{notice}</AuthMessage>}
          </div>
        )}

        {/* Google Login Button (Google brand colours kept) */}
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleLogin}
          className="h-12 w-full gap-3 px-4 text-base"
          disabled={busy}
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continuar com Google
        </Button>

        <AuthDivider label="Ou utilize o seu email" />

        {/* Email Login Form (form so that Enter submits; validation stays in handleEmailLogin) */}
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            handleEmailLogin();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="o.seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <Label htmlFor="password">Palavra-passe</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <div className="mt-2 text-right">
              <AuthLink href="/auth/forgot-password" className="text-sm">
                Esqueceu-se da palavra-passe?
              </AuthLink>
            </div>
          </div>

          <Button type="submit" size="sm" className="h-10 w-full" loading={busy}>
            {busy ? 'A iniciar sessão...' : 'Iniciar sessão'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Não tem conta? <AuthLink href="/register">Criar conta</AuthLink>
        </p>
      </div>
    </AuthShell>
  );
}
