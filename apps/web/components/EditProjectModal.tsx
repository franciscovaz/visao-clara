'use client';

import { useState, useEffect } from 'react';
import { HiX } from 'react-icons/hi';

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

  useEffect(() => {
    if (project) {
      console.log('💰 EditProjectModal - Budget from backend:', project.budget);
      console.log('💰 EditProjectModal - Budget type:', typeof project.budget);
      
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
      
      console.log('💰 EditProjectModal - Budget set to:', budgetValue);
    }
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    console.log('🚀 EditProjectModal - handleSubmit called!');
    e.preventDefault();
    
    if (!name.trim() || !type) {
      return;
    }
    
    if (type === 'other' && !projectDescription.trim()) {
      return;
    }
    
    console.log('🚀 EditProjectModal - Calling onSubmit prop...');
    console.log('🚀 EditProjectModal - onSubmit prop type:', typeof onSubmit);
    console.log('🚀 EditProjectModal - onSubmit prop exists:', !!onSubmit);
    
    const result = onSubmit({
      name: name.trim(),
      project_type: type,
      goal: description.trim() || undefined,
      project_description: type === 'other' ? projectDescription.trim() : undefined,
      current_phase: phase || undefined,
      property_type: propertyType || undefined,
      budget: budget.trim() || undefined,
    });
    
    console.log('🚀 EditProjectModal - onSubmit called, result:', result);
    console.log('🚀 EditProjectModal - onSubmit called, waiting for parent...');
  };

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

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
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <HiX className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Editar Projeto</h2>
            <p className="text-sm text-gray-600">
              Edite as informações principais do projeto. Os campos obrigatórios estão marcados com *.
            </p>
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tipo de Investimento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectTypes.map((projectType) => (
                  <div
                    key={projectType.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      type === projectType.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => setType(projectType.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{projectType.icon}</div>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-medium ${
                          type === projectType.id ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {projectType.title}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conditional Description Input */}
              {type === 'other' && (
                <div className="md:ml-auto md:max-w-md">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Descrição (opcional)
                  </label>
                  <input
                    type="text"
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tipo de Imóvel</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {propertyTypes.map((propertyTypeOption) => (
                  <div
                    key={propertyTypeOption.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      propertyType === propertyTypeOption.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => setPropertyType(propertyTypeOption.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{propertyTypeOption.icon}</div>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-medium ${
                          propertyType === propertyTypeOption.id ? 'text-blue-900' : 'text-gray-900'
                        }`}>
                          {propertyTypeOption.title}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Conditional Property Description Input */}
              {propertyType === 'other' && (
                <div className="md:ml-auto md:max-w-md">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Descrição do Imóvel (opcional)
                  </label>
                  <input
                    type="text"
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
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
