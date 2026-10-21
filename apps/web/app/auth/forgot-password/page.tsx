'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiHome } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { supabase, PASSWORD_RESET_PATH } from '@/lib/supabase/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const router = useRouter();
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md mx-auto p-6 md:p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <HiHome className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Recuperar palavra-passe
          </h1>
          <p className="text-sm text-slate-600">
            Indique o email da sua conta e enviaremos uma ligação para definir uma nova palavra-passe.
          </p>
        </div>

        {sent ? (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">
              Se existir uma conta associada a este email, receberá em breve uma mensagem com uma
              ligação para redefinir a palavra-passe. Verifique também a pasta de spam.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

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
                disabled={isSubmitting}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'A enviar...' : 'Enviar ligação de recuperação'}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Voltar ao login
          </button>
        </div>
      </Card>
    </div>
  );
}
