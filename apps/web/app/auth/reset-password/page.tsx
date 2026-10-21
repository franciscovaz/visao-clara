'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { HiHome } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import {
  supabase,
  getRecoveryState,
  onRecoveryStateChange,
  clearRecoveryState,
  type RecoveryState,
} from '@/lib/supabase/client';
import { useAuthStore } from '@/src/store/authStore';

const MIN_PASSWORD_LENGTH = 8;

// The recovery link can only be read in the browser; render the checking state on the server
const SERVER_RECOVERY_STATE: RecoveryState = { status: 'pending' };

export default function ResetPasswordPage() {
  const router = useRouter();
  const recovery = useSyncExternalStore(onRecoveryStateChange, getRecoveryState, () => SERVER_RECOVERY_STATE);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || recovery.status !== 'ready') return;

    const errors: { password?: string; confirmPassword?: string } = {};
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `A palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'As palavras-passe não coincidem.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setError('');
    setIsSubmitting(true);
    try {
      // The current session must still be the one the recovery link created
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== recovery.userId) {
        clearRecoveryState();
        setLinkExpired(true);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        console.error('Password update failed:', updateError.status, updateError.code);
        if (updateError.code === 'same_password') {
          setFieldErrors({ password: 'A nova palavra-passe tem de ser diferente da anterior.' });
        } else if (updateError.code === 'weak_password') {
          setFieldErrors({ password: 'A palavra-passe não cumpre os requisitos mínimos de segurança.' });
        } else if (updateError.status === 401 || updateError.status === 403 || updateError.name === 'AuthSessionMissingError') {
          clearRecoveryState();
          setLinkExpired(true);
        } else {
          setError('Não foi possível atualizar a palavra-passe. Tente novamente.');
        }
        return;
      }

      // Recovery is single-use: end it and require a fresh login with the new password
      clearRecoveryState();
      try {
        await useAuthStore.getState().signOut();
      } catch (signOutError) {
        console.error('Sign out after password reset failed:', signOutError instanceof Error ? signOutError.message : signOutError);
      }
      setCompleted(true);
    } catch {
      setError('Não foi possível atualizar a palavra-passe. Verifique a sua ligação e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    if (completed) {
      return (
        <div className="space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">
              A sua palavra-passe foi atualizada. Inicie sessão com a nova palavra-passe.
            </p>
          </div>
          {/* Full navigation clears any in-memory data from the recovery session */}
          <Button className="w-full" onClick={() => window.location.replace('/login')}>
            Ir para o login
          </Button>
        </div>
      );
    }

    if (linkExpired || recovery.status === 'invalid' || recovery.status === 'none') {
      return (
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">
              A ligação de recuperação é inválida ou expirou. Peça uma nova ligação para redefinir a
              palavra-passe.
            </p>
          </div>
          <Button className="w-full" onClick={() => router.push('/auth/forgot-password')}>
            Pedir nova ligação
          </Button>
        </div>
      );
    }

    if (recovery.status === 'pending') {
      return (
        <div className="flex flex-col items-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <p className="mt-4 text-sm text-slate-600">A validar a ligação de recuperação...</p>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
            Nova palavra-passe
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
          />
          {fieldErrors.password ? (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.password}</p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">Mínimo de {MIN_PASSWORD_LENGTH} caracteres.</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
            Confirmar nova palavra-passe
          </label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
          />
          {fieldErrors.confirmPassword && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'A guardar...' : 'Guardar nova palavra-passe'}
        </Button>
      </form>
    );
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
            Definir nova palavra-passe
          </h1>
        </div>

        {renderContent()}
      </Card>
    </div>
  );
}
