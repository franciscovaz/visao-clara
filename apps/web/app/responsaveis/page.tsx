'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiPlus, HiPencil, HiTrash, HiEnvelope, HiPhone, HiMapPin } from 'react-icons/hi2';
import { Card } from '@/components/ui/Card';
import AppLayout from '@/components/AppLayout';
import { useProjectStore } from '@/src/store/projectStore';
import { Responsible } from '@/src/mocks';
import ProjectHeader from '@/src/components/ProjectHeader';

const getRoleColor = (role: Responsible['role']) => {
  switch (role) {
    case 'architect':
      return 'bg-blue-100 text-blue-800';
    case 'contractor':
      return 'bg-orange-100 text-orange-800';
    case 'civil_engineer':
      return 'bg-green-100 text-green-800';
    case 'supervisor':
      return 'bg-purple-100 text-purple-800';
    case 'other':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getRoleLabel = (role: Responsible['role']) => {
  switch (role) {
    case 'architect':
      return 'Arquiteto';
    case 'contractor':
      return 'Empreiteiro';
    case 'civil_engineer':
      return 'Engenheiro Civil';
    case 'supervisor':
      return 'Fiscalização';
    case 'other':
      return 'Outro';
    default:
      return 'Outro';
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
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    role: 'architect' as Responsible['role'],
    email: '',
    phone: '',
    city: ''
  });
  
  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Edit state
  const [editingResponsible, setEditingResponsible] = useState<Responsible | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Get active project responsibles from store
  const projectId = useProjectStore(s => s.activeProjectId);
  const { getResponsiblesForProject, addResponsible, updateResponsible, deleteResponsible, getLimit } = useProjectStore();
  const responsibles = getResponsiblesForProject(projectId);
  
  // Get billing entitlements for responsible limit
  const activeProjectsLimit = getLimit('activeProjects');
  const isFreePlan = typeof activeProjectsLimit === 'number';
  const hasUnlimitedProjects = activeProjectsLimit === 'unlimited';
  
  // Determine responsible limit based on plan
  const maxResponsibles = isFreePlan ? 5 : 'unlimited';
  const isLimitReached = typeof maxResponsibles === 'number' && responsibles.length >= maxResponsibles;

  const handleUpgrade = () => {
    router.replace(`/${projectId}/profile?tab=plans`);
  };

  const handleAddResponsible = () => {
    if (!isLimitReached) {
      setIsEditMode(false);
      setEditingResponsible(null);
      setIsModalOpen(true);
      // Reset form when opening modal
      setFormData({
        name: '',
        company: '',
        role: 'architect',
        email: '',
        phone: '',
        city: ''
      });
      setFormErrors({});
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    // Required fields validation
    if (!formData.name.trim()) {
      errors.name = 'Nome completo é obrigatório';
    }
    
    if (!formData.company.trim()) {
      errors.company = 'Empresa é obrigatória';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido';
    }
    
    if (!formData.phone.trim()) {
      errors.phone = 'Telemóvel é obrigatório';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    if (isEditMode && editingResponsible) {
      // Update existing responsible
      updateResponsible(projectId, editingResponsible.id, {
        ...formData,
        city: formData.city.trim() || undefined
      });
    } else {
      // Check limit again (in case it changed)
      if (isLimitReached) {
        return;
      }
      
      // Add new responsible to store
      addResponsible(projectId, {
        ...formData,
        city: formData.city.trim() || undefined
      });
    }
    
    // Close modal and reset form
    setIsModalOpen(false);
    setIsEditMode(false);
    setEditingResponsible(null);
    setFormData({
      name: '',
      company: '',
      role: 'architect',
      email: '',
      phone: '',
      city: ''
    });
    setFormErrors({});
  };

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleEditResponsible = (responsible: Responsible) => {
    setIsEditMode(true);
    setEditingResponsible(responsible);
    setFormData({
      name: responsible.name,
      company: responsible.company,
      role: responsible.role,
      email: responsible.email,
      phone: responsible.phone,
      city: responsible.city || ''
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDeleteResponsible = (responsible: Responsible) => {
    deleteResponsible(projectId, responsible.id);
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
            disabled={isLimitReached}
            className={`w-fit flex items-center gap-2 px-5 py-3 rounded-xl transition-colors font-semibold ${
              isLimitReached 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-black text-white hover:bg-gray-800'
            }`}
            title={isLimitReached ? `Limite de ${maxResponsibles} responsáveis atingido` : ''}
          >
            <HiPlus className="w-5 h-5" />
            <span className="hidden sm:inline">Adicionar responsável</span>
            <span className="sm:hidden">Adicionar</span>
          </button>
        </div>
      </div>

      {/* Counter Banner */}
      {isLimitReached && (
        <div className="mb-6 p-4 bg-sky-50 border-sky-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <p className="text-sm font-medium text-sky-900">
                  {responsibles.length} de {maxResponsibles} responsáveis usados
                </p>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500 text-white">
                  Limite atingido
                </span>
              </div>
              <p className="text-sky-600 text-sm">
                Disponível no plano Pro
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
            >
              Upgrade
            </button>
          </div>
        </div>
      )}

      {!isLimitReached && (
        <div className="mb-6 p-4 bg-blue-50 border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                {responsibles.length} de {maxResponsibles} responsáveis usados
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {responsibles.length} responsáveis adicionados
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Responsibles List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                      {getRoleLabel(responsible.role)}
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
          <div className="col-span-full">
            <Card className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HiPlus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ainda não existem responsáveis para este projeto.</h3>
              <p className="text-gray-500 mb-4">Adicione o primeiro responsável para começar a gerir a sua obra.</p>
              <button
                onClick={handleAddResponsible}
                className="inline-flex items-center px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                <HiPlus className="w-4 h-4 mr-2" />
                Adicionar responsável
              </button>
            </Card>
          </div>
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
              Pode adicionar até {maxResponsibles} responsáveis por projeto para gerir eficazmente todos os profissionais envolvidos na sua obra.
            </p>
          </div>
        </div>
      </div>

      {/* Add/Edit Responsible Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {isEditMode ? 'Editar Responsável' : 'Adicionar Responsável'}
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                {isEditMode 
                  ? 'Edite as informações do profissional responsável pela obra. Todos os campos marcados com * são obrigatórios.'
                  : 'Adicione um novo profissional responsável pela obra. Todos os campos marcados com * são obrigatórios.'
                }
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome completo */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Nome completo *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={handleInputChange('name')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 ${
                      formErrors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="João Silva"
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                  )}
                </div>

                {/* Empresa */}
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                    Empresa *
                  </label>
                  <input
                    type="text"
                    id="company"
                    value={formData.company}
                    onChange={handleInputChange('company')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 ${
                      formErrors.company ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Construções S.A."
                  />
                  {formErrors.company && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.company}</p>
                  )}
                </div>

                {/* Função / Responsabilidade */}
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                    Função / Responsabilidade *
                  </label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={handleInputChange('role')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 ${
                      formErrors.role ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="architect">Arquiteto</option>
                    <option value="contractor">Empreiteiro</option>
                    <option value="civil_engineer">Engenheiro Civil</option>
                    <option value="supervisor">Fiscalização</option>
                    <option value="other">Outro</option>
                  </select>
                  {formErrors.role && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={handleInputChange('email')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 ${
                      formErrors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="joao.silva@empresa.pt"
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                  )}
                </div>

                {/* Telemóvel */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Telemóvel *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={handleInputChange('phone')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 ${
                      formErrors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="+351 912 345 678"
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                  )}
                </div>

                {/* Cidade */}
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={formData.city}
                    onChange={handleInputChange('city')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                    placeholder="Lisboa"
                  />
                </div>

                {/* Buttons */}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isLimitReached && !isEditMode}
                    className="w-full sm:w-auto px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isEditMode ? 'Guardar Alterações' : 'Adicionar Responsável'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
