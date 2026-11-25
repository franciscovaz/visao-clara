'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OptionCard, OPTION_ICONS } from '@/components/OptionCard';
import { OnboardingShell, OptionGrid } from '@/components/OnboardingShell';
import { useAppContextStore } from '@/src/store/appContextStore';

const phases = [
  {
    id: 'planning',
    icon: OPTION_ICONS.phase['planning'],
    title: 'Planeamento',
  },
  {
    id: 'design',
    icon: OPTION_ICONS.phase['design'],
    title: 'Design',
  },
  {
    id: 'licenses',
    icon: OPTION_ICONS.phase['licenses'],
    title: 'Licenças',
  },
  {
    id: 'construction',
    icon: OPTION_ICONS.phase['construction'],
    title: 'Construção',
  },
  {
    id: 'finishing',
    icon: OPTION_ICONS.phase['finishing'],
    title: 'Acabamentos',
  },
  {
    id: 'completed',
    icon: OPTION_ICONS.phase['completed'],
    title: 'Concluído',
  },
];

export default function OnboardingStep3() {
  const router = useRouter();
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const { setPendingOnboardingData, pendingOnboardingData } = useAppContextStore();

  const handlePhaseSelect = (phaseId: string) => {
    setSelectedPhase(phaseId);
  };

  const handleNext = () => {
    // Save step data to store
    setPendingOnboardingData({
      projectType: pendingOnboardingData?.projectType || '',
      projectDescription: pendingOnboardingData?.projectDescription,
      propertyType: pendingOnboardingData?.propertyType || '',
      propertyDescription: pendingOnboardingData?.propertyDescription,
      currentPhase: selectedPhase || '',
      goal: pendingOnboardingData?.goal || '',
      budget: pendingOnboardingData?.budget,
    });
    
    router.push('/onboarding/step4');
  };

  const handleBack = () => {
    router.push('/onboarding/step2');
  };

  return (
    <OnboardingShell
      step={3}
      totalSteps={5}
      title="Fase atual"
      description="Em que fase está o projeto?"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-10 gap-2 px-3">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button size="sm" onClick={handleNext} disabled={!selectedPhase} className="h-10 gap-2">
            Seguinte
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </>
      }
    >
      <OptionGrid label="Fase atual">
        {phases.map((phase) => (
          <OptionCard
            key={phase.id}
            icon={phase.icon}
            title={phase.title}
            selected={selectedPhase === phase.id}
            onClick={() => handlePhaseSelect(phase.id)}
          />
        ))}
      </OptionGrid>
    </OnboardingShell>
  );
}
