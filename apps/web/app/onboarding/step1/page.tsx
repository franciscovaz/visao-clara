'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OptionCard, OPTION_ICONS } from '@/components/OptionCard';
import { OnboardingShell, OptionGrid } from '@/components/OnboardingShell';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAppContextStore } from '@/src/store/appContextStore';

const projectTypes = [
  {
    id: 'new-construction',
    icon: OPTION_ICONS.projectType['new-construction'],
    title: 'Nova Construção',
  },
  {
    id: 'renovation',
    icon: OPTION_ICONS.projectType['renovation'],
    title: 'Renovação',
  },
  {
    id: 'purchase-with-works',
    icon: OPTION_ICONS.projectType['purchase-with-works'],
    title: 'Compra + Obras',
  },
  {
    id: 'investment',
    icon: OPTION_ICONS.projectType['investment'],
    title: 'Investimento',
  },
  {
    id: 'other',
    icon: OPTION_ICONS.projectType['other'],
    title: 'Outro',
  },
];

export default function OnboardingStep1() {
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectDescription, setProjectDescription] = useState('');
  const { setPendingOnboardingData, pendingOnboardingData } = useAppContextStore();

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
    // Clear description when switching away from 'other'
    if (projectId !== 'other') {
      setProjectDescription('');
    }
  };

  const handleNext = () => {
    if (!selectedProject) return;

    // Validation: if 'other' is selected, description is required
    if (selectedProject === 'other' && !projectDescription.trim()) {
      return;
    }
    
    // Save step data to store
    setPendingOnboardingData({
      projectType: selectedProject,
      projectDescription: selectedProject === 'other' ? projectDescription : undefined,
      propertyType: pendingOnboardingData?.propertyType || '',
      propertyDescription: pendingOnboardingData?.propertyDescription,
      currentPhase: pendingOnboardingData?.currentPhase || '',
      goal: pendingOnboardingData?.goal || '',
      budget: pendingOnboardingData?.budget,
    });
    
    router.push('/onboarding/step2');
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <OnboardingShell
      step={1}
      totalSteps={5}
      title="Tipo de projeto"
      description="Que tipo de projeto está a gerir?"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleBack} className="h-10 gap-2 px-3">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar
          </Button>
          <Button size="sm" onClick={handleNext} disabled={!selectedProject || (selectedProject === 'other' && !projectDescription.trim())} className="h-10 gap-2">
            Seguinte
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <OptionGrid label="Tipo de projeto">
          {projectTypes.map((project) => (
            <OptionCard
              key={project.id}
              icon={project.icon}
              title={project.title}
              selected={selectedProject === project.id}
              onClick={() => handleProjectSelect(project.id)}
            />
          ))}
        </OptionGrid>

        {/* Conditional Description Input */}
        {selectedProject === 'other' && (
            <div className="sm:ml-auto sm:max-w-md">
              <Label htmlFor="project-description">Descrição (opcional)</Label>
              <Input
                id="project-description"
                type="text"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Ex: Remodelação parcial, Projeto misto..."
                maxLength={80}
                aria-describedby="project-description-count"
              />
              <p id="project-description-count" className="mt-1.5 text-xs text-gray-500">
                {projectDescription.length}/80 caracteres
              </p>
            </div>
        )}
      </div>
    </OnboardingShell>
  );
}
