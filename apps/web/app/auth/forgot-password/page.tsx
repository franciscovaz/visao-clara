'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { AuthShell, AuthMessage, AuthLink } from '@/components/AuthShell';
import { supabase, PASSWORD_RESET_PATH } from '@/lib/supabase/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Introduza um email válido.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}${PASSWORD_RESET_PATH}`,
      });

      // Rate limits can depend on whether the account exists, so a 429 gets the
      // same generic confirmation to avoid revealing registered emails
      if (resetError && resetError.status !== 429) {
        console.error('Password recovery request failed:', resetError.status, resetError.code);
        setError(
          resetError.status === 0 || resetError.name === 'AuthRetryableFetchError'
            ? 'Não foi possível enviar o pedido. Verifique a sua ligação e tente novamente.'
            : 'Não foi possível processar o pedido. Tente novamente mais tarde.',
        );
        return;
      }

      setSent(true);
    } catch {
      setError('Não foi possível enviar o pedido. Verifique a sua ligação e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Recuperar palavra-passe"
      description="Indique o email da sua conta e enviaremos uma ligação para definir uma nova palavra-passe."
      footer={
        <p className="text-center text-sm">
          <AuthLink href="/login" className="inline-flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar ao login
          </AuthLink>
        </p>
      }
    >
      {sent ? (
        <AuthMessage tone="success">
          Se existir uma conta associada a este email, receberá em breve uma mensagem com uma
          ligação para redefinir a palavra-passe. Verifique também a pasta de spam.
        </AuthMessage>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && <AuthMessage tone="error">{error}</AuthMessage>}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="o.seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <Button type="submit" size="sm" className="h-10 w-full" loading={isSubmitting}>
            {isSubmitting ? 'A enviar...' : 'Enviar ligação de recuperação'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
