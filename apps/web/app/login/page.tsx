'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiHome } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/src/store/authStore';
import { supabase } from '../../lib/supabase/client';

export default function Login() {
  const router = useRouter();
  const { signIn, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [devStatus, setDevStatus] = useState('');

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
      
      // Debug: Log current origin and redirect URL
      const currentOrigin = window.location.origin;
      const redirectUrl = `${currentOrigin}/auth/callback`;
      
      console.log('🔍 Current origin:', currentOrigin);
      console.log('🔍 Redirect URL will be:', redirectUrl);
      console.log('🚀 Initiating Google OAuth login...');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      console.log('🔍 Google OAuth result:', { data, error });
      
      if (error) {
        throw error;
      }
      
      // OAuth will redirect to Google, then back to callback
      console.log('✅ OAuth initiated, redirecting to Google...');
    } catch (err: any) {
      console.error('❌ Google OAuth error:', err);
      setError(err.message || 'Erro ao fazer login com Google');
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('Por favor, preencha email e senha');
      return;
    }

    try {
      setError('');
      await signIn(email, password);
      router.push('/proj_1/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
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
            Entre para salvar seu projeto e acessá-lo de qualquer dispositivo
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
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
            disabled={loading}
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
              <span className="px-2 bg-white text-slate-500">OU CONTINUE COM EMAIL</span>
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

            {/* Login Button */}
            <Button
              onClick={handleEmailLogin}
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
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
              Registar
            </button>
          </p>
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
