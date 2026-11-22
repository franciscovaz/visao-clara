'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';

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
    icon: '🏢',
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
        <div role="alert" className="-mt-3 mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nome do Projeto */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Nome do Projeto *
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            required
          />
        </div>

        {/* Investment Type */}
        <div className="mb-8">
          <h3 id="edit-project-type-heading" className="text-lg font-semibold text-gray-900 mb-4">Tipo de Investimento</h3>
          <div role="group" aria-labelledby="edit-project-type-heading" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectTypes.map((projectType) => (
              <button
                key={projectType.id}
                type="button"
                aria-pressed={type === projectType.id}
                className={`w-full text-left border rounded-lg p-4 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  type === projectType.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
                onClick={() => setType(projectType.id)}
              >
                <span className="flex items-center space-x-3">
                  <span className="text-2xl" aria-hidden="true">{projectType.icon}</span>
                  <span className="flex-1 text-left">
                    <span className={`block text-sm font-medium ${
                      type === projectType.id ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {projectType.title}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* Conditional Description Input */}
          {type === 'other' && (
            <div className="md:ml-auto md:max-w-md">
              <label htmlFor="edit-project-description" className="block text-sm font-medium text-slate-700 mb-2">
                Descrição (opcional)
              </label>
              <input
                type="text"
                id="edit-project-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Ex: Remodelação parcial, Projeto misto..."
                maxLength={80}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1">
                {projectDescription.length}/80 caracteres
              </p>
            </div>
          )}
        </div>

        {/* Property Type */}
        <div className="mb-8">
          <h3 id="edit-property-type-heading" className="text-lg font-semibold text-gray-900 mb-4">Tipo de Imóvel</h3>
          <div role="group" aria-labelledby="edit-property-type-heading" className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {propertyTypes.map((propertyTypeOption) => (
              <button
                key={propertyTypeOption.id}
                type="button"
                aria-pressed={propertyType === propertyTypeOption.id}
                className={`w-full text-left border rounded-lg p-4 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  propertyType === propertyTypeOption.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
                onClick={() => setPropertyType(propertyTypeOption.id)}
              >
                <span className="flex items-center space-x-3">
                  <span className="text-2xl" aria-hidden="true">{propertyTypeOption.icon}</span>
                  <span className="flex-1 text-left">
                    <span className={`block text-sm font-medium ${
                      propertyType === propertyTypeOption.id ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {propertyTypeOption.title}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* Conditional Property Description Input */}
          {propertyType === 'other' && (
            <div className="md:ml-auto md:max-w-md">
              <label htmlFor="edit-property-description" className="block text-sm font-medium text-slate-700 mb-2">
                Descrição do Imóvel (opcional)
              </label>
              <input
                type="text"
                id="edit-property-description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Ex: Casa com 3 quartos, Terreno com..."
                maxLength={80}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-1">
                {projectDescription.length}/80 caracteres
              </p>
            </div>
          )}
        </div>

        {/* Investment Goal */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Objetivo do Investimento</h3>
          <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-1">
            Objetivo do Investimento
          </label>
          <textarea
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            placeholder="Descreva os objetivos principais do projeto..."
          />
        </div>

        {/* Estimated Budget */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Orçamento Estimado</h3>
          <label htmlFor="budget" className="block text-sm font-medium text-gray-700 mb-1">
            Orçamento Estimado (€)
          </label>
          <input
            type="text"
            id="budget"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            placeholder="50000"
          />
        </div>

        {/* Current Phase */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Fase Atual</h3>
          <label htmlFor="phase" className="block text-sm font-medium text-gray-700 mb-1">
            Fase
          </label>
          <select
            id="phase"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            {projectPhases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.label}
              </option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'A Guardar...' : 'Guardar Alterações'}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
