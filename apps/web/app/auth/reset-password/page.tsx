'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Spinner } from '@/components/ui/Spinner';
import { AuthShell, AuthMessage } from '@/components/AuthShell';
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
          <AuthMessage tone="success">
            A sua palavra-passe foi atualizada. Inicie sessão com a nova palavra-passe.
          </AuthMessage>
          {/* Full navigation clears any in-memory data from the recovery session */}
          <Button type="button" size="sm" className="h-10 w-full" onClick={() => window.location.replace('/login')}>
            Ir para o login
          </Button>
        </div>
      );
    }

    if (linkExpired || recovery.status === 'invalid' || recovery.status === 'none') {
      return (
        <div className="space-y-4">
          <AuthMessage tone="error">
            A ligação de recuperação é inválida ou expirou. Peça uma nova ligação para redefinir a
            palavra-passe.
          </AuthMessage>
          <Button type="button" size="sm" className="h-10 w-full" onClick={() => router.push('/auth/forgot-password')}>
            Pedir nova ligação
          </Button>
        </div>
      );
    }

    if (recovery.status === 'pending') {
      return (
        <div className="flex flex-col items-center py-6">
          <Spinner label={null} />
          <p role="status" className="mt-4 text-sm text-gray-600">A validar a ligação de recuperação...</p>
        </div>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <AuthMessage tone="error">{error}</AuthMessage>}

        <div>
          <Label htmlFor="password">Nova palavra-passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby="password-help"
          />
          {fieldErrors.password ? (
            <p id="password-help" className="mt-1.5 text-sm text-red-600">{fieldErrors.password}</p>
          ) : (
            <p id="password-help" className="mt-1.5 text-xs text-gray-500">Mínimo de {MIN_PASSWORD_LENGTH} caracteres.</p>
          )}
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirmar nova palavra-passe</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
            aria-invalid={fieldErrors.confirmPassword ? true : undefined}
            aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
          />
          {fieldErrors.confirmPassword && (
            <p id="confirm-password-error" className="mt-1.5 text-sm text-red-600">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        <Button type="submit" size="sm" className="h-10 w-full" loading={isSubmitting}>
          {isSubmitting ? 'A guardar...' : 'Guardar nova palavra-passe'}
        </Button>
      </form>
    );
  };

  return (
    <AuthShell title="Definir nova palavra-passe">
      {renderContent()}
    </AuthShell>
  );
}
