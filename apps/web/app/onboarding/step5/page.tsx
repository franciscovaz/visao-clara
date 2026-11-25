'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { OnboardingShell } from '@/components/OnboardingShell';
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
    <OnboardingShell
      step={5}
      totalSteps={5}
      title="Orçamento estimado"
      description="Qual é o orçamento previsto? (opcional)"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-10 gap-2 px-3">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSkip} disabled={isSaving} className="h-10">
              Saltar
            </Button>

            <Button size="sm" onClick={handleFinish} loading={isSaving} className="h-10 gap-2">
              {isSaving ? 'A criar projeto...' : 'Concluir'}
              {!isSaving && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="budget">Orçamento (€)</Label>
          <Input
            id="budget"
            type="text"
            inputMode="numeric"
            placeholder="Ex: 50.000"
            value={formatBudgetDisplay(budget)}
            onChange={handleBudgetChange}
            aria-describedby="budget-help"
            className="h-12 text-lg"
          />
          <p id="budget-help" className="mt-2 text-sm text-gray-500">
            Pode saltar este passo, se preferir.
          </p>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="min-w-0 wrap-anywhere">{error}</p>
          </div>
        )}
      </div>
    </OnboardingShell>
  );
}
