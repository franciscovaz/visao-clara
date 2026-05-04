'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiX, HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ProjectTypeCard } from '@/components/ProjectTypeCard';
import { PropertyTypeCard } from '@/components/PropertyTypeCard';
import { PhaseCard } from '@/components/PhaseCard';
import { GoalCard } from '@/components/GoalCard';
import { useProjectStore } from '@/src/store/projectStore';
import { supabase } from '@/lib/supabase/client';

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
  {
    id: 'other',
    icon: '📋',
    title: 'Outro',
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
  const [projectTypeDescription, setProjectTypeDescription] = useState('');
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
    projectTypeDescription: '',
  });
  const [budget, setBudget] = useState('');
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addProject, setActiveProjectId } = useProjectStore();
  const router = useRouter();

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

  const handleFinish = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Utilizador não autenticado');
        setIsLoading(false);
        return;
      }

      const { data: tenantMembers } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1);

      if (!tenantMembers?.length) {
        setError('Nenhum tenant encontrado');
        setIsLoading(false);
        return;
      }

      const tenantId = tenantMembers[0].tenant_id;

      const projectTypeValue = selectedProjectType === 'other'
        ? projectTypeDescription
        : projectData.projectType;

      const { data, error: insertError } = await supabase
        .from('projects')
        .insert({
          tenant_id: tenantId,
          name: projectData.name,
          status: 'active',
          created_by: user.id,
          project_type: projectTypeValue,
          property_type: selectedPropertyType || null,
          goal: selectedGoal,
          budget: budget || null,
          current_phase: selectedPhase,
        })
        .select()
        .single();

      if (insertError) {
        setError('Erro ao criar projeto');
        setIsLoading(false);
        return;
      }

      if (data) {
        const newProject = {
          id: data.id,
          name: data.name,
          location: location,
          type: data.project_type || '',
          propertyType: data.property_type || '',
          phase: data.current_phase || '',
          goal: data.goal || '',
          budget: data.budget || '',
          status: data.status,
          progress: 0,
          tenant_id: data.tenant_id,
          created_by: data.created_by,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        addProject(newProject);
        setActiveProjectId(data.id);
        onClose();
        setCurrentStep(1);
        setSelectedProjectType(null);
        setProjectTypeDescription('');
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
          projectTypeDescription: '',
        });
        setBudget('');
        setLocation('');
        router.push(`/${data.id}/dashboard`);
      }
    } catch (err) {
      setError('Erro inesperado ao criar projeto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset wizard state
    setCurrentStep(1);
    setSelectedProjectType(null);
    setProjectTypeDescription('');
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
      projectTypeDescription: '',
    });
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return projectData.name.trim() !== '';
      case 2: 
        return selectedProjectType !== null && (selectedProjectType !== 'other' || projectTypeDescription.trim() !== '');
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
            <div className="space-y-4">
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
                      // Clear description when switching away from 'other'
                      if (type.id !== 'other') {
                        setProjectTypeDescription('');
                      }
                    }}
                  />
                ))}
              </div>

              {/* Conditional Description Input */}
              {selectedProjectType === 'other' && (
                <div className="md:ml-auto md:max-w-md">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
                    value={projectTypeDescription}
                    onChange={(e) => setProjectTypeDescription(e.target.value)}
                    placeholder="Ex: Remodelação parcial, Projeto misto..."
                    maxLength={80}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none text-slate-900"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {projectTypeDescription.length}/80 caracteres
                  </p>
                </div>
              )}
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
