'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useAppContextStore, type OnboardingData } from '@/src/store/appContextStore';
import { ProfileService } from '@/src/services/profileService';
import { supabase } from '@/lib/supabase/client';

export default function OnboardingStep5() {
  const router = useRouter();
  const [budget, setBudget] = useState<string>('');
  const { setPendingOnboardingData, pendingOnboardingData } = useAppContextStore();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const finishOnboarding = async (finalBudget: string | undefined) => {
    if (isSaving) return;
    const data: OnboardingData = {
      projectType: pendingOnboardingData?.projectType || '',
      projectDescription: pendingOnboardingData?.projectDescription,
      propertyType: pendingOnboardingData?.propertyType || '',
      propertyDescription: pendingOnboardingData?.propertyDescription,
      currentPhase: pendingOnboardingData?.currentPhase || '',
      goal: pendingOnboardingData?.goal || '',
      budget: finalBudget,
    };
    // Persisted, so the answers survive Google OAuth and email confirmation redirects
    setPendingOnboardingData(data);

    setIsSaving(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      // Already signed in (e.g. an account without a project): finish here
      await ProfileService.resumePendingOnboarding();
      const redirectUrl = await ProfileService.getPostLoginRedirect();
      if (!redirectUrl) {
        setError('Não foi possível carregar o seu projeto. Tente novamente.');
        return;
      }
      router.push(redirectUrl);
    } catch (err) {
      console.error('Onboarding completion failed:', err instanceof Error ? err.message : err);
      setError('Não foi possível criar o seu projeto. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinish = () => finishOnboarding(budget || undefined);

  const handleSkip = () => finishOnboarding(undefined);

  const handleBack = () => {
    router.push('/onboarding/step4');
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, '');
    setBudget(value);
  };

  const formatBudgetDisplay = (value: string) => {
    if (!value) return '';
    const number = parseInt(value, 10);
    if (isNaN(number)) return '';
    return number.toLocaleString('pt-PT');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <ProgressBar current={5} total={5} label="Passo 5 de 5" />
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Orçamento estimado
          </h1>
          <p className="text-lg text-slate-600">
            Qual é o orçamento previsto? (opcional)
          </p>
        </div>

        <div className="mb-8">
          <label htmlFor="budget" className="block text-sm font-medium text-slate-700 mb-2">
            Orçamento (€)
          </label>
          <Input
            id="budget"
            type="text"
            placeholder="Ex: 50.000"
            value={formatBudgetDisplay(budget)}
            onChange={handleBudgetChange}
            className="text-lg"
          />
          <p className="text-sm text-slate-500 mt-2">
            Pode saltar este passo, se preferir.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-6 border-t border-slate-200">
          <Button
            variant="secondary"
            onClick={handleBack}
            className="flex items-center space-x-2"
          >
            <HiChevronLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Button>

          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              onClick={handleSkip}
              disabled={isSaving}
              className="flex items-center space-x-2"
            >
              <span>Saltar</span>
            </Button>

            <Button
              onClick={handleFinish}
              disabled={isSaving}
              className="flex items-center space-x-2"
            >
              <span>{isSaving ? 'A criar projeto...' : 'Concluir'}</span>
              <HiChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
