'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { AuthShell, AuthMessage, AuthLink, AuthLegalNotice } from '@/components/AuthShell';
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
    <AuthShell
      title={awaitingConfirmation ? 'Confirme o seu email' : 'Criar conta'}
      description={awaitingConfirmation ? 'Falta apenas um passo para começar.' : 'Crie a sua conta para começar'}
      footer={<AuthLegalNotice />}
    >
      {awaitingConfirmation ? (
        <div className="space-y-4">
          <AuthMessage tone="success">
            Enviámos uma mensagem para <strong>{email.trim()}</strong> com uma ligação para
            confirmar a sua conta. Abra-a neste dispositivo para continuar. Se não a encontrar,
            verifique a pasta de spam.
          </AuthMessage>
          <Button type="button" variant="outline" size="sm" className="h-10 w-full" onClick={() => router.push('/login')}>
            Ir para o login
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {error && <AuthMessage tone="error">{error}</AuthMessage>}

          {/* Registration Form (form so that Enter submits; validation stays in handleRegister) */}
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              handleRegister();
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
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="password">Palavra-passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                aria-describedby="password-help"
              />
              <p id="password-help" className="mt-1.5 text-xs text-gray-500">Mínimo de {MIN_PASSWORD_LENGTH} caracteres.</p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar palavra-passe</Label>
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

            <Button type="submit" size="sm" className="h-10 w-full" loading={loading}>
              {loading ? 'A criar conta...' : 'Criar conta'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-600">
            Já tem conta? <AuthLink href="/login">Iniciar sessão</AuthLink>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
