'use client';

import { useState, useEffect } from 'react';
import { HiX } from 'react-icons/hi';
import { Project } from '@/src/mocks';

type EditProjectModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (updates: Partial<Project>) => void;
  project: Project | null;
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
const projectPhases = ['planning', 'construction', 'completed'];

export default function EditProjectModal({ isOpen, onClose, onSubmit, project }: EditProjectModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phase, setPhase] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name);
      setType(project.type);
      setDescription(project.description || '');
      setProjectDescription(project.projectTypeDescription || '');
      setAddress(project.address || '');
      setCity(project.city || '');
      setPhase(project.phase || '');
    }
  }, [project]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !type) {
      return;
    }
    
    if (type === 'other' && !projectDescription.trim()) {
      return;
    }
    
    onSubmit({
      name: name.trim(),
      type,
      description: description.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      phase,
      projectTypeDescription: type === 'other' ? projectDescription.trim() : undefined,
    });

    onClose();
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
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
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

            {/* Tipo de Projeto */}
            <div className="space-y-4 mb-8">
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

            {/* Descrição / Objetivo */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Descrição / Objetivo
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Descreva os objetivos principais do projeto..."
              />
            </div>

            {/* Morada */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Morada
              </label>
              <input
                type="text"
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Rua, número, etc."
              />
            </div>

            {/* Cidade */}
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                Cidade
              </label>
              <input
                type="text"
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Nome da cidade"
              />
            </div>

            {/* Fase */}
            <div>
              <label htmlFor="phase" className="block text-sm font-medium text-gray-700 mb-1">
                Fase
              </label>
              <select
                id="phase"
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              >
                <option value="planning">Planeamento</option>
                <option value="construction">Construção</option>
                <option value="completed">Concluído</option>
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
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Guardar Alterações
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
