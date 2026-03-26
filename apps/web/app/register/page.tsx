'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiHome } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAppContextStore } from '@/src/store/appContextStore';
import { supabase } from '../../lib/supabase/client';

export default function Register() {
  const router = useRouter();
  const { hasPendingOnboarding, pendingOnboardingData, clearPendingOnboardingData } = useAppContextStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setError('Por favor, preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setLoading(true);

      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      // Check if user has pending onboarding data
      if (hasPendingOnboarding()) {
        setSuccess('Conta criada com sucesso! Seus dados de onboarding foram salvos. A redirecionar...');
        // TODO: In future phase, this would trigger backend bootstrap after email verification
        // For now, just keep the data and redirect to login
      } else {
        setSuccess('Conta criada com sucesso! A redirecionar...');
      }
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
      
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Erro ao criar conta');
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
            Criar conta
          </h1>
          
          {/* Subtitle */}
          <p className="text-sm text-slate-600">
            Crie sua conta para começar
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-600">{success}</p>
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
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
              Senha
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Confirm Password Input */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
              Confirmar Senha
            </label>
            <Input
              id="confirmPassword"
              type="password"
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
            {loading ? 'A criar conta...' : 'Registar'}
          </Button>

          {/* Login Link */}
          <div className="text-center pt-2">
            <p className="text-sm text-slate-600">
              Já tem conta?{' '}
              <button
                onClick={() => router.push('/login')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Entrar
              </button>
            </p>
          </div>
        </div>

        {/* Footer Text */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">
            Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade
          </p>
        </div>
      </Card>
    </div>
  );
}
