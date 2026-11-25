'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { OptionCard, OPTION_ICONS } from '@/components/OptionCard';

type RealProject = {
  id: string;
  name: string;
  status: string;
  tenant_id: string;
  created_by: string;
  project_type?: string;
  project_description?: string;
  property_type?: string;
  property_description?: string;
  current_phase?: string;
  goal?: string;
  budget?: string;
  created_at: string;
  updated_at: string;
};

type EditProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (updates: Partial<RealProject>) => void;
  project: RealProject | null;
  isSubmitting?: boolean;
  error?: string | null;
};

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
const projectPhases = [
  { id: 'planning', label: 'Planeamento' },
  { id: 'design', label: 'Design' },
  { id: 'licenses', label: 'Licenças' },
  { id: 'construction', label: 'Construção' },
  { id: 'finishing', label: 'Acabamentos' },
  { id: 'completed', label: 'Concluído' }
];

export default function EditProjectModal({ isOpen, onClose, onSubmit, project, isSubmitting = false, error }: EditProjectModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [phase, setPhase] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [goal, setGoal] = useState('');
  const [budget, setBudget] = useState('');

  // Prefill from the saved project on every opening, so edits discarded with Cancelar/Escape don't reappear
  useEffect(() => {
    if (isOpen && project) {
      setName(project.name || '');
      setType(project.project_type || '');
      setDescription(project.goal || '');
      setProjectDescription(project.project_description || '');
      setPhase(project.current_phase || '');
      setPropertyType(project.property_type || '');
      setGoal(project.goal || '');
      
      // Normalize budget value for input
      const budgetValue = project.budget ? String(project.budget) : '';
      setBudget(budgetValue);
    }
  }, [isOpen, project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // A save is already in flight (e.g. a second Enter/click before the button re-renders as disabled)
    if (isSubmitting) {
      return;
    }

    if (!name.trim() || !type) {
      return;
    }
    
    if (type === 'other' && !projectDescription.trim()) {
      return;
    }
    
    onSubmit({
      name: name.trim(),
      project_type: type,
      goal: description.trim() || undefined,
      project_description: type === 'other' ? projectDescription.trim() : undefined,
      current_phase: phase || undefined,
      property_type: propertyType || undefined,
      budget: budget.trim() || undefined,
    });
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Editar Projeto"
      description={
        // block + text-sm keeps the previous description size and line height
        <span className="block text-sm">
          Edite as informações principais do projeto. Os campos obrigatórios estão marcados com *.
        </span>
      }
      size="2xl"
      // A save in progress cannot be dismissed (Escape, backdrop and the close button are blocked)
      dismissible={!isSubmitting}
    >
      {error && (
        // -mt-3 mb-6: same position as before, 12px under the description and 24px above the form
        <div role="alert" className="-mt-3 mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 wrap-anywhere">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nome do Projeto */}
        <div>
          <Label htmlFor="name">Nome do Projeto *</Label>
          <Input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Investment Type */}
        <div className="space-y-3">
          <h3 id="edit-project-type-heading" className="text-sm font-medium text-gray-700">Tipo de Investimento *</h3>
          <div role="group" aria-labelledby="edit-project-type-heading" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {projectTypes.map((projectType) => (
              <OptionCard
                key={projectType.id}
                layout="row"
                icon={projectType.icon}
                title={projectType.title}
                selected={type === projectType.id}
                onClick={() => setType(projectType.id)}
              />
            ))}
          </div>

          {/* Conditional Description Input */}
          {type === 'other' && (
            <div className="sm:ml-auto sm:max-w-md">
              <Label htmlFor="edit-project-description">Descrição (opcional)</Label>
              <Input
                type="text"
                id="edit-project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Ex: Remodelação parcial, Projeto misto..."
                maxLength={80}
                aria-describedby="edit-project-description-count"
              />
              <p id="edit-project-description-count" className="mt-1.5 text-xs text-gray-500">
                {projectDescription.length}/80 caracteres
              </p>
            </div>
          )}
        </div>

        {/* Property Type */}
        <div className="space-y-3">
          <h3 id="edit-property-type-heading" className="text-sm font-medium text-gray-700">Tipo de Imóvel</h3>
          <div role="group" aria-labelledby="edit-property-type-heading" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {propertyTypes.map((propertyTypeOption) => (
              <OptionCard
                key={propertyTypeOption.id}
                layout="row"
                icon={propertyTypeOption.icon}
                title={propertyTypeOption.title}
                selected={propertyType === propertyTypeOption.id}
                onClick={() => setPropertyType(propertyTypeOption.id)}
              />
            ))}
          </div>

          {/* Conditional Property Description Input */}
          {propertyType === 'other' && (
            <div className="sm:ml-auto sm:max-w-md">
              <Label htmlFor="edit-property-description">Descrição do Imóvel (opcional)</Label>
              <Input
                type="text"
                id="edit-property-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Ex: Casa com 3 quartos, Terreno com..."
                maxLength={80}
                aria-describedby="edit-property-description-count"
              />
              <p id="edit-property-description-count" className="mt-1.5 text-xs text-gray-500">
                {projectDescription.length}/80 caracteres
              </p>
            </div>
          )}
        </div>

        {/* Investment Goal */}
        <div>
          <Label htmlFor="goal">Objetivo do Investimento</Label>
          <Textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            placeholder="Descreva os objetivos principais do projeto..."
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Estimated Budget */}
          <div>
            <Label htmlFor="budget">Orçamento Estimado (€)</Label>
            <Input
              type="text"
              id="budget"
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="50000"
            />
          </div>

          {/* Current Phase */}
          <div>
            <Label htmlFor="phase">Fase Atual</Label>
            <Select id="phase" value={phase} onChange={(e) => setPhase(e.target.value)}>
              {projectPhases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Buttons */}
        <ModalFooter className="space-x-0 gap-3 border-t border-gray-100 pt-6">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="h-10 flex-1">
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={isSubmitting} className="h-10 flex-1">
            {isSubmitting ? 'A guardar...' : 'Guardar Alterações'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
