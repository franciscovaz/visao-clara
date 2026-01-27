'use client';

import { useState } from 'react';
import { HiPlus, HiPencil, HiTrash, HiEnvelope, HiPhone, HiMapPin } from 'react-icons/hi2';
import { Card } from '@/components/ui/Card';
import AppLayout from '@/components/AppLayout';
import { useProjectStore } from '@/src/store/projectStore';
import { mockResponsibles, Responsible } from '@/src/mocks';
import ProjectHeader from '@/src/components/ProjectHeader';

const MAX_RESPONSIBLES = 5;

const getRoleColor = (role: Responsible['role']) => {
  switch (role) {
    case 'Arquiteto':
      return 'bg-blue-100 text-blue-800';
    case 'Empreiteiro':
      return 'bg-orange-100 text-orange-800';
    case 'Engenheiro Civil':
      return 'bg-green-100 text-green-800';
    case 'Fiscalização':
      return 'bg-purple-100 text-purple-800';
    case 'Outro':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function ResponsaveisPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Get active project responsibles from mocks
  const projectId = useProjectStore(s => s.activeProjectId);
  const responsibles = mockResponsibles.filter(r => r.projectId === projectId);
  
  const isAtLimit = responsibles.length >= MAX_RESPONSIBLES;

  const handleAddResponsible = () => {
    if (!isAtLimit) {
      setIsModalOpen(true);
    }
  };

  const handleEditResponsible = (responsible: Responsible) => {
    // TODO: Implement edit functionality
    console.log('Edit responsible:', responsible);
  };

  const handleDeleteResponsible = (responsible: Responsible) => {
    // TODO: Implement delete functionality
    console.log('Delete responsible:', responsible);
  };

  return (
    <AppLayout 
      currentPage="responsaveis"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      {/* Project Header */}
      <ProjectHeader />

      {/* Section Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900">Responsáveis da Obra</h1>
            <p className="text-gray-500 text-base">Gerir contactos dos profissionais responsáveis pela obra</p>
          </div>

          <button
            onClick={handleAddResponsible}
            disabled={isAtLimit}
            className={`w-fit flex items-center gap-2 px-5 py-3 rounded-xl transition-colors font-semibold ${
              isAtLimit 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-black text-white hover:bg-gray-800'
            }`}
            title={isAtLimit ? `Limite de ${MAX_RESPONSIBLES} responsáveis atingido` : ''}
          >
            <HiPlus className="w-5 h-5" />
            <span className="hidden sm:inline">+ Adicionar responsável</span>
            <span className="sm:hidden">+ Adicionar</span>
          </button>
        </div>
      </div>

      {/* Counter Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-900">
              {responsibles.length} de {MAX_RESPONSIBLES} responsáveis usados
            </p>
            <p className="text-xs text-blue-700 mt-1">
              {responsibles.length} responsáveis adicionados
            </p>
          </div>
          {isAtLimit && (
            <div className="text-xs text-blue-700">
              Limite atingido
            </div>
          )}
        </div>
      </div>

      {/* Responsibles List */}
      <div className="space-y-4">
        {responsibles.map((responsible) => (
          <Card key={responsible.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                {/* Avatar */}
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-semibold">
                  {getInitials(responsible.name)}
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{responsible.name}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(responsible.role)}`}>
                      {responsible.role}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{responsible.company}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-500">
                      <HiEnvelope className="w-4 h-4 mr-2" />
                      {responsible.email}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <HiPhone className="w-4 h-4 mr-2" />
                      {responsible.phone}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <HiMapPin className="w-4 h-4 mr-2" />
                      {responsible.city}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleEditResponsible(responsible)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <HiPencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteResponsible(responsible)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <HiTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}

        {responsibles.length === 0 && (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <HiPlus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sem responsáveis</h3>
            <p className="text-gray-500 mb-4">Adicione o primeiro responsável para começar a gerir a sua obra.</p>
            <button
              onClick={handleAddResponsible}
              className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <HiPlus className="w-4 h-4 mr-2" />
              Adicionar responsável
            </button>
          </Card>
        )}
      </div>

      {/* Bottom Info Banner */}
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-xs text-blue-600 font-semibold">i</span>
          </div>
          <div>
            <p className="text-sm text-gray-700">
              <span className="font-medium">{responsibles.length} responsáveis adicionados</span> - 
              Pode adicionar até {MAX_RESPONSIBLES} responsáveis por projeto para gerir eficazmente todos os profissionais envolvidos na sua obra.
            </p>
          </div>
        </div>
      </div>

      {/* Add Responsible Modal - TODO: Implement */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black bg-opacity-15"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Adicionar Responsável</h2>
            <p className="text-gray-600 mb-6">Funcionalidade a implementar</p>
            <button
              onClick={() => setIsModalOpen(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
