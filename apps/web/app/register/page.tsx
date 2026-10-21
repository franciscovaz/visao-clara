'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiHome } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ProfileService } from '@/src/services/profileService';
import { supabase } from '../../lib/supabase/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function signUpErrorMessage(error: { status?: number; code?: string; name?: string }): string {
  switch (error.code) {
    case 'weak_password':
      return 'A palavra-passe é demasiado fraca. Escolha uma palavra-passe mais segura.';
    case 'email_address_invalid':
      return 'Introduza um email válido.';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'O registo está temporariamente indisponível.';
    case 'user_already_exists':
    case 'email_exists':
      // Only returned when email confirmation is off (local dev); keep it generic
      return 'Não foi possível criar a conta. Se já tem conta, inicie sessão ou recupere a palavra-passe.';
  }
  if (error.status === 429) {
    return 'Demasiados pedidos. Aguarde alguns minutos e tente novamente.';
  }
  if (error.status === 0 || error.name === 'AuthRetryableFetchError') {
    return 'Não foi possível ligar ao servidor. Verifique a sua ligação e tente novamente.';
  }
  return 'Não foi possível criar a conta. Tente novamente.';
}

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const handleRegister = async () => {
    if (loading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Introduza um email válido.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('As palavras-passe não coincidem.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // Onboarding answers (if any) are already persisted in appContextStore and
      // are applied by /auth/callback after the user confirms the email
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        console.error('Registration failed:', signUpError.status, signUpError.code);
        setError(signUpErrorMessage(signUpError));
        return;
      }

      if (!data.session) {
        // Email confirmation required (also returned for existing emails, by design)
        setAwaitingConfirmation(true);
        return;
      }

      // Confirmation disabled: the user is already signed in
      try {
        await ProfileService.resumePendingOnboarding();
      } catch (onboardingError) {
        console.error('Onboarding completion failed:', onboardingError instanceof Error ? onboardingError.message : onboardingError);
        setError('Conta criada, mas não foi possível criar o seu projeto. Inicie sessão para tentar novamente.');
        return;
      }
      const redirectUrl = await ProfileService.getPostLoginRedirect();
      if (!redirectUrl) {
        setError('Conta criada, mas não foi possível carregar os seus projetos. Inicie sessão novamente.');
        return;
      }
      router.push(redirectUrl);
    } catch (err) {
      console.error('Registration error:', err instanceof Error ? err.message : err);
      setError('Não foi possível criar a conta. Tente novamente.');
    } finally {
      setLoading(false);
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
            {awaitingConfirmation ? 'Confirme o seu email' : 'Criar conta'}
          </h1>

          {/* Subtitle */}
          <p className="text-sm text-slate-600">
            {awaitingConfirmation
              ? 'Falta apenas um passo para começar.'
              : 'Crie a sua conta para começar'}
          </p>
        </div>

        {awaitingConfirmation ? (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">
                Enviámos uma mensagem para <strong>{email.trim()}</strong> com uma ligação para
                confirmar a sua conta. Abra-a neste dispositivo para continuar. Se não a encontrar,
                verifique a pasta de spam.
              </p>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => router.push('/login')}>
              Ir para o login
            </Button>
          </div>
        ) : (
          <>
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Registration Form */}
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
                  disabled={loading}
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
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-slate-500">Mínimo de {MIN_PASSWORD_LENGTH} caracteres.</p>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                  Confirmar palavra-passe
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Register Button */}
              <Button
                onClick={handleRegister}
                className="w-full"
                disabled={loading}
              >
                {loading ? 'A criar conta...' : 'Criar conta'}
              </Button>

              {/* Login Link */}
              <div className="text-center pt-2">
                <p className="text-sm text-slate-600">
                  Já tem conta?{' '}
                  <button
                    onClick={() => router.push('/login')}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Iniciar sessão
                  </button>
                </p>
              </div>
            </div>
          </>
        )}

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
