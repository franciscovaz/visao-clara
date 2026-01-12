'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ProgressBar } from '@/components/ui/ProgressBar';

export default function OnboardingStep5() {
  const router = useRouter();
  const [budget, setBudget] = useState<string>('');

  const handleFinish = () => {
    console.log('Onboarding completed with budget:', budget);
    router.push('/login');
  };

  const handleSkip = () => {
    console.log('Onboarding completed without budget');
    router.push('/login');
  };

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
    return number.toLocaleString('pt-BR');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <ProgressBar current={5} total={5} label="Etapa 5 de 5" />
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Orçamento Estimado
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
            Você pode pular esta etapa se preferir
          </p>
        </div>

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
              className="flex items-center space-x-2"
            >
              <span>Pular</span>
            </Button>

            <Button
              onClick={handleFinish}
              className="flex items-center space-x-2"
            >
              <span>Concluir</span>
              <HiChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
