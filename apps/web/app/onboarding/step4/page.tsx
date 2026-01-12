'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { GoalCard } from '@/components/GoalCard';

const goals = [
  {
    id: 'live',
    icon: '🏠',
    title: 'Morar',
  },
  {
    id: 'rent',
    icon: '🔑',
    title: 'Alugar',
  },
  {
    id: 'sell',
    icon: '💰',
    title: 'Vender',
  },
  {
    id: 'long-term-investment',
    icon: '📈',
    title: 'Investimento de Longo Prazo',
  },
];

export default function OnboardingStep4() {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const handleGoalSelect = (goalId: string) => {
    setSelectedGoal(goalId);
  };

  const handleNext = () => {
    console.log('Selected goal:', selectedGoal);
    router.push('/onboarding/step5');
  };

  const handleBack = () => {
    router.push('/onboarding/step3');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <ProgressBar current={4} total={5} label="Etapa 4 de 5" />
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Objetivo Principal
          </h1>
          <p className="text-lg text-slate-600">
            Qual é seu objetivo com este imóvel?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              icon={goal.icon}
              title={goal.title}
              selected={selectedGoal === goal.id}
              onClick={() => handleGoalSelect(goal.id)}
            />
          ))}
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

          <Button
            onClick={handleNext}
            disabled={!selectedGoal}
            className="flex items-center space-x-2"
          >
            <span>Próximo</span>
            <HiChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
