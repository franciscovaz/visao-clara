'use client';

import { useState } from 'react';
import { HiX, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProjectTypeCard } from '@/components/ProjectTypeCard';
import { PropertyTypeCard } from '@/components/PropertyTypeCard';
import { PhaseCard } from '@/components/PhaseCard';
import { GoalCard } from '@/components/GoalCard';
import { useProjectStore } from '@/src/store/projectStore';

interface AddProjectWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to generate project ID
const generateProjectId = () => {
  return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Step data (reuse exact same data from onboarding)
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

const propertyTypes = [
  {
    id: 'house',
    icon: '🏠',
    title: 'Casa',
  },
  {
    id: 'apartment',
    icon: '🏢',
    title: 'Apartamento',
  },
  {
    id: 'other',
    icon: '🏗️',
    title: 'Outro',
  },
];

const phases = [
  {
    id: 'planning',
    icon: '📋',
    title: 'Planeamento',
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

export default function AddProjectWizard({ isOpen, onClose }: AddProjectWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProjectType, setSelectedProjectType] = useState<string | null>(null);
  const [selectedPropertyType, setSelectedPropertyType] = useState<string | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [projectData, setProjectData] = useState({
    name: '',
    projectType: '',
    propertyType: '',
    currentPhase: '',
    mainGoal: '',
    estimatedBudget: '',
  });

  const { addProject, setActiveProjectId, seedDefaultExpenseCategories } = useProjectStore();

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleFinish = () => {
    const newProject = {
      id: generateProjectId(),
      name: projectData.name,
      type: projectData.projectType,
      propertyType: projectData.propertyType,
      phase: projectData.currentPhase,
      mainGoal: projectData.mainGoal,
      estimatedBudget: projectData.estimatedBudget ? parseFloat(projectData.estimatedBudget) : undefined,
      description: '',
      address: '',
      city: '',
    };

    // Add project to store
    addProject(newProject);
    
    // Seed default categories for new project
    seedDefaultExpenseCategories(newProject.id);
    
    // Set as active project
    setActiveProjectId(newProject.id);

    onClose();
    // Reset wizard state
    setCurrentStep(1);
    setSelectedProjectType(null);
    setSelectedPropertyType(null);
    setSelectedPhase(null);
    setSelectedGoal(null);
    setProjectData({
      name: '',
      projectType: '',
      propertyType: '',
      currentPhase: '',
      mainGoal: '',
      estimatedBudget: '',
    });
  };

  const handleClose = () => {
    onClose();
    // Reset wizard state
    setCurrentStep(1);
    setSelectedProjectType(null);
    setSelectedPropertyType(null);
    setSelectedPhase(null);
    setSelectedGoal(null);
    setProjectData({
      name: '',
      projectType: '',
      propertyType: '',
      currentPhase: '',
      mainGoal: '',
      estimatedBudget: '',
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return projectData.name.trim() !== '';
      case 2: return selectedProjectType !== null;
      case 3: return selectedPropertyType !== null;
      case 4: return selectedPhase !== null;
      case 5: return selectedGoal !== null;
      case 6: return true; // Budget is optional
      default: return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Nome do Projeto</h2>
              <p className="text-lg text-slate-600">Dê um nome para identificar seu projeto</p>
            </div>
            <div>
              <input
                type="text"
                value={projectData.name}
                onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
                placeholder="Ex: Casa da Praia, Apartamento Centro"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none text-slate-900"
                autoFocus
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Tipo de Projeto</h2>
              <p className="text-lg text-slate-600">Que tipo de projeto você está gerenciando?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectTypes.map((type) => (
                <ProjectTypeCard
                  key={type.id}
                  icon={type.icon}
                  title={type.title}
                  selected={selectedProjectType === type.id}
                  onClick={() => {
                    setSelectedProjectType(type.id);
                    setProjectData({ ...projectData, projectType: type.title });
                  }}
                />
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Tipo de Imóvel</h2>
              <p className="text-lg text-slate-600">Qual o tipo do imóvel?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {propertyTypes.map((type) => (
                <PropertyTypeCard
                  key={type.id}
                  icon={type.icon}
                  title={type.title}
                  selected={selectedPropertyType === type.id}
                  onClick={() => {
                    setSelectedPropertyType(type.id);
                    setProjectData({ ...projectData, propertyType: type.title });
                  }}
                  className={type.id === 'other' ? 'md:col-span-3' : ''}
                />
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Fase Atual</h2>
              <p className="text-lg text-slate-600">Em que fase está o projeto?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {phases.map((phase) => (
                <PhaseCard
                  key={phase.id}
                  icon={phase.icon}
                  title={phase.title}
                  selected={selectedPhase === phase.id}
                  onClick={() => {
                    setSelectedPhase(phase.id);
                    setProjectData({ ...projectData, currentPhase: phase.title });
                  }}
                />
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Objetivo Principal</h2>
              <p className="text-lg text-slate-600">Qual o objetivo principal deste projeto?</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  icon={goal.icon}
                  title={goal.title}
                  selected={selectedGoal === goal.id}
                  onClick={() => {
                    setSelectedGoal(goal.id);
                    setProjectData({ ...projectData, mainGoal: goal.title });
                  }}
                />
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Orçamento Estimado (opcional)</h2>
              <p className="text-lg text-slate-600">Qual o orçamento estimado para o projeto?</p>
            </div>
            <div>
              <input
                type="number"
                value={projectData.estimatedBudget}
                onChange={(e) => setProjectData({ ...projectData, estimatedBudget: e.target.value })}
                placeholder="0"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none text-slate-900"
                autoFocus
              />
              <p className="text-sm text-slate-500 mt-2">Valor em EUR (€)</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors z-10"
        >
          <HiX className="w-5 h-5" />
        </button>

        {/* Modal Content */}
        <div className="p-6 md:p-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <ProgressBar current={currentStep} total={6} label={`Etapa ${currentStep} de 6`} />
          </div>

          {/* Step Content */}
          <div className="mb-8">
            {renderStep()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={currentStep === 1 ? handleClose : handleBack}
              className="flex items-center space-x-2"
            >
              <HiChevronLeft className="w-4 h-4" />
              <span>{currentStep === 1 ? 'Cancelar' : 'Voltar'}</span>
            </Button>

            <div className="flex space-x-3">
              {currentStep === 6 && (
                <Button
                  variant="secondary"
                  onClick={handleSkip}
                  className="flex items-center space-x-2"
                >
                  <span>Pular</span>
                </Button>
              )}
              
              <Button
                onClick={currentStep === 6 ? handleFinish : handleNext}
                disabled={!canProceed()}
                className="flex items-center space-x-2"
              >
                <span>{currentStep === 6 ? 'Concluir' : 'Próximo'}</span>
                {currentStep !== 6 && <HiChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
