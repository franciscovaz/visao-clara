'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiHome } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
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
  const [devStatus, setDevStatus] = useState('');
  const busy = loading || isSubmitting;

  // DEV-ONLY: Create test user
  const handleCreateTestUser = async () => {
    if (process.env.NODE_ENV !== 'development') {
      setError('This feature is only available in development');
      return;
    }

    try {
      setDevStatus('Creating test user...');
      setError('');

      const { data, error } = await supabase.auth.signUp({
        email: 'teste@visaoclara.pt',
        password: 'Teste123456!',
      });

      if (error) {
        // If user already exists, that's okay for dev
        if (error.message.includes('already registered')) {
          setDevStatus('✅ Test user already exists. You can login with teste@visaoclara.pt');
        } else {
          throw error;
        }
      } else {
        setDevStatus('✅ Test user created! You can now login with teste@visaoclara.pt / Teste123456!');
      }
    } catch (err: any) {
      console.error('❌ Create test user error:', err);
      setDevStatus('');
      setError(err.message || 'Failed to create test user');
    }
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md mx-auto p-6 md:p-8">
        {/* Top Section */}
        <div className="text-center mb-8">
          {/* App Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <HiHome className="w-8 h-8 text-white" />
            </div>
          </div>
          
          {/* Welcome Title */}
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Bem-vindo ao Visão Clara
          </h1>
          
          {/* Subtitle */}
          <p className="text-sm text-slate-600">
            Inicie sessão para guardar o seu projeto e aceder-lhe em qualquer dispositivo
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
            {unconfirmedEmail && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={isResending}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {isResending ? 'A enviar...' : 'Reenviar email de confirmação'}
              </button>
            )}
          </div>
        )}

        {/* Notice Message */}
        {notice && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">{notice}</p>
          </div>
        )}

        {/* Dev Status Message */}
        {devStatus && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{devStatus}</p>
          </div>
        )}

        {/* Authentication Section */}
        <div className="space-y-4">
          {/* Google Login Button */}
          <Button
            variant="secondary"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center space-x-2"
            disabled={busy}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            <span>Continuar com Google</span>
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">OU UTILIZE O SEU EMAIL</span>
            </div>
          </div>

          {/* Email Login Form */}
          <div className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
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

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Palavra-passe
              </label>
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
                <button
                  type="button"
                  onClick={() => router.push('/auth/forgot-password')}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Esqueceu-se da palavra-passe?
                </button>
              </div>
            </div>

            {/* Login Button */}
            <Button
              onClick={handleEmailLogin}
              className="w-full"
              disabled={busy}
            >
              {busy ? 'A iniciar sessão...' : 'Iniciar sessão'}
            </Button>
          </div>
        </div>

        {/* DEV-ONLY Test User Creation */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-3">DEV ONLY - Test User Creation</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCreateTestUser}
                disabled={!!devStatus}
                className="text-xs"
              >
                {devStatus || 'Create Test User (teste@visaoclara.pt)'}
              </Button>
            </div>
          </div>
        )}

        {/* Register Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            Não tem conta?{' '}
            <button
              onClick={() => router.push('/register')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Criar conta
            </button>
          </p>
        </div>

        {/* Footer Text */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            Ao continuar, aceita os nossos Termos de Serviço e a Política de Privacidade.
          </p>
        </div>
      </Card>
    </div>
  );
}
