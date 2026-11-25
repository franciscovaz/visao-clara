'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { OptionCard, OPTION_ICONS } from '@/components/OptionCard';
import { OptionGrid } from '@/components/OnboardingShell';
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

const propertyTypes = [
  {
    id: 'house',
    icon: OPTION_ICONS.propertyType['house'],
    title: 'Casa',
  },
  {
    id: 'apartment',
    icon: OPTION_ICONS.propertyType['apartment'],
    title: 'Apartamento',
  },
  {
    id: 'other',
    icon: OPTION_ICONS.propertyType['other'],
    title: 'Outro',
  },
];

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

  // Step copy (pt-PT). Titles/descriptions are display only.
  const STEP_COPY: Record<number, { title: string; description: string }> = {
    1: { title: 'Nome do projeto', description: 'Dê um nome para identificar o seu projeto' },
    2: { title: 'Tipo de projeto', description: 'Que tipo de projeto está a gerir?' },
    3: { title: 'Tipo de imóvel', description: 'Que tipo de imóvel?' },
    4: { title: 'Fase atual', description: 'Em que fase está o projeto?' },
    5: { title: 'Objetivo principal', description: 'Qual é o objetivo principal deste projeto?' },
    6: { title: 'Orçamento estimado (opcional)', description: 'Qual é o orçamento estimado para o projeto?' },
  };
  const stepCopy = STEP_COPY[currentStep];

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div>
            <Label htmlFor="wizard-project-name">Nome do projeto</Label>
            <Input
              id="wizard-project-name"
              type="text"
              value={projectData.name}
              onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
              placeholder="Ex: Casa da Praia, Apartamento Centro"
              className="h-12 text-base"
              autoFocus
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <OptionGrid label="Tipo de projeto">
              {projectTypes.map((type) => (
                <OptionCard
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
            </OptionGrid>

            {/* Conditional Description Input */}
            {selectedProjectType === 'other' && (
              <div className="sm:ml-auto sm:max-w-md">
                <Label htmlFor="wizard-project-type-description">Descrição (opcional)</Label>
                <Input
                  id="wizard-project-type-description"
                  type="text"
                  value={projectTypeDescription}
                  onChange={(e) => setProjectTypeDescription(e.target.value)}
                  placeholder="Ex: Remodelação parcial, Projeto misto..."
                  maxLength={80}
                  aria-describedby="wizard-project-type-description-count"
                />
                <p id="wizard-project-type-description-count" className="mt-1.5 text-xs text-gray-500">
                  {projectTypeDescription.length}/80 caracteres
                </p>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <OptionGrid label="Tipo de imóvel" columns={3}>
            {propertyTypes.map((type) => (
              <OptionCard
                key={type.id}
                icon={type.icon}
                title={type.title}
                selected={selectedPropertyType === type.id}
                onClick={() => {
                  setSelectedPropertyType(type.id);
                  setProjectData({ ...projectData, propertyType: type.title });
                }}
              />
            ))}
          </OptionGrid>
        );

      case 4:
        return (
          <OptionGrid label="Fase atual">
            {phases.map((phase) => (
              <OptionCard
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
          </OptionGrid>
        );

      case 5:
        return (
          <OptionGrid label="Objetivo principal">
            {goals.map((goal) => (
              <OptionCard
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
          </OptionGrid>
        );

      case 6:
        return (
          <div>
            <Label htmlFor="wizard-budget">Orçamento (€)</Label>
            <Input
              id="wizard-budget"
              type="number"
              value={projectData.estimatedBudget}
              onChange={(e) => setProjectData({ ...projectData, estimatedBudget: e.target.value })}
              placeholder="0"
              aria-describedby="wizard-budget-help"
              className="h-12 text-base"
              autoFocus
            />
            <p id="wizard-budget-help" className="mt-2 text-sm text-gray-500">Valor em EUR (€)</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={stepCopy?.title}
      description={<span className="block text-base text-gray-500">{stepCopy?.description}</span>}
      size="2xl"
      // A project being created cannot be dismissed (Escape, backdrop and the close button are blocked)
      dismissible={!isLoading}
    >
      <div className="-mt-2 mb-6 space-y-2">
        <ProgressBar current={currentStep} total={6} label={`Passo ${currentStep} de 6`} showLabel={false} />
        <p className="text-sm text-gray-500">Passo {currentStep} de 6</p>
      </div>

      {/* Step Content */}
      <div className="mb-6">{renderStep()}</div>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 wrap-anywhere">{error}</p>
        </div>
      )}

      {/* Navigation Buttons: kept visible at the bottom of the scrollable dialog on short screens */}
      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-white px-6 py-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={currentStep === 1 ? handleClose : handleBack}
          disabled={isLoading}
          className="h-10 gap-2 px-3"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {currentStep === 1 ? 'Cancelar' : 'Voltar'}
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {currentStep === 6 && (
            <Button variant="outline" size="sm" onClick={handleSkip} disabled={isLoading} className="h-10">
              Saltar
            </Button>
          )}

          <Button
            size="sm"
            onClick={currentStep === 6 ? handleFinish : handleNext}
            disabled={!canProceed()}
            loading={isLoading}
            className="h-10 gap-2"
          >
            {currentStep === 6 ? (isLoading ? 'A criar projeto...' : 'Concluir') : 'Seguinte'}
            {currentStep !== 6 && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
