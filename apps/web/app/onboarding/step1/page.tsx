'use client';

import { useState } from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProjectTypeCard } from '@/components/ProjectTypeCard';

const projectTypes = [
  {
    id: 'new-construction',
    icon: '🏗️',
    title: 'Nova Construção',
  },
  {
    id: 'renovation',
    icon: '🔨',
    title: 'Renovação',
  },
  {
    id: 'purchase-with-works',
    icon: '🏡',
    title: 'Compra + Obras',
  },
  {
    id: 'investment',
    icon: '📈',
    title: 'Investimento',
  },
];

export default function OnboardingStep1() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId);
  };

  const handleNext = () => {
    // Navigation to next step will be implemented later
    console.log('Selected project:', selectedProject);
  };

  const handleBack = () => {
    // Navigation back will be implemented later
    console.log('Going back');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-2xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <ProgressBar current={1} total={5} label="Etapa 1 de 5" />
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Tipo de Projeto
          </h1>
          <p className="text-lg text-slate-600">
            Que tipo de projeto você está gerenciando?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {projectTypes.map((project) => (
            <ProjectTypeCard
              key={project.id}
              icon={project.icon}
              title={project.title}
              selected={selectedProject === project.id}
              onClick={() => handleProjectSelect(project.id)}
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
            disabled={!selectedProject}
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
