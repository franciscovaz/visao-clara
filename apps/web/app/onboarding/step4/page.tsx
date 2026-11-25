'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OptionCard, OPTION_ICONS } from '@/components/OptionCard';
import { OnboardingShell, OptionGrid } from '@/components/OnboardingShell';
import { useAppContextStore } from '@/src/store/appContextStore';

const goals = [
  {
    id: 'live',
    icon: OPTION_ICONS.goal['live'],
    title: 'Habitar',
  },
  {
    id: 'rent',
    icon: OPTION_ICONS.goal['rent'],
    title: 'Arrendar',
  },
  {
    id: 'sell',
    icon: OPTION_ICONS.goal['sell'],
    title: 'Vender',
  },
  {
    id: 'long-term-investment',
    icon: OPTION_ICONS.goal['long-term-investment'],
    title: 'Investimento a longo prazo',
  },
];

export default function OnboardingStep4() {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const { setPendingOnboardingData, pendingOnboardingData } = useAppContextStore();

  const handleGoalSelect = (goalId: string) => {
    setSelectedGoal(goalId);
  };

  const handleNext = () => {
    // Save step data to store
    setPendingOnboardingData({
      projectType: pendingOnboardingData?.projectType || '',
      projectDescription: pendingOnboardingData?.projectDescription,
      propertyType: pendingOnboardingData?.propertyType || '',
      propertyDescription: pendingOnboardingData?.propertyDescription,
      currentPhase: pendingOnboardingData?.currentPhase || '',
      goal: selectedGoal || '',
      budget: pendingOnboardingData?.budget,
    });
    
    router.push('/onboarding/step5');
  };

  const handleBack = () => {
    router.push('/onboarding/step3');
  };

  return (
    <OnboardingShell
      step={4}
      totalSteps={5}
      title="Objetivo principal"
      description="Qual é o seu objetivo para este imóvel?"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-10 gap-2 px-3">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button size="sm" onClick={handleNext} disabled={!selectedGoal} className="h-10 gap-2">
            Seguinte
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </>
      }
    >
      <OptionGrid label="Objetivo principal">
        {goals.map((goal) => (
          <OptionCard
            key={goal.id}
            icon={goal.icon}
            title={goal.title}
            selected={selectedGoal === goal.id}
            onClick={() => handleGoalSelect(goal.id)}
          />
        ))}
      </OptionGrid>
    </OnboardingShell>
  );
}
