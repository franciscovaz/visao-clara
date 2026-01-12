'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PhaseCard } from '@/components/PhaseCard';

const phases = [
  {
    id: 'planning',
    icon: '📋',
    title: 'Planejamento',
  },
  {
    id: 'design',
    icon: '🎨',
    title: 'Design',
  },
  {
    id: 'licenses',
    icon: '📄',
    title: 'Licenças',
  },
  {
    id: 'construction',
    icon: '🏗️',
    title: 'Construção',
  },
  {
    id: 'finishing',
    icon: '🔨',
    title: 'Acabamentos',
  },
  {
    id: 'completed',
    icon: '✅',
    title: 'Concluído',
  },
];

export default function OnboardingStep3() {
  const router = useRouter();
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  const handlePhaseSelect = (phaseId: string) => {
    setSelectedPhase(phaseId);
  };

  const handleNext = () => {
    console.log('Selected phase:', selectedPhase);
    router.push('/onboarding/step4');
  };

  const handleBack = () => {
    router.push('/onboarding/step2');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <ProgressBar current={3} total={5} label="Etapa 3 de 5" />
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Fase Atual
          </h1>
          <p className="text-lg text-slate-600">
            Em que fase está o projeto?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {phases.map((phase) => (
            <PhaseCard
              key={phase.id}
              icon={phase.icon}
              title={phase.title}
              selected={selectedPhase === phase.id}
              onClick={() => handlePhaseSelect(phase.id)}
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
            disabled={!selectedPhase}
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
