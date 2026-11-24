'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Pencil, Trash2, Mail, Phone, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import AppLayout from '@/components/AppLayout';
import { useProjectStore } from '@/src/store/projectStore';
import { Responsible } from '@/src/mocks';
import ProjectHeader from '@/src/components/ProjectHeader';
import { supabase } from '@/lib/supabase/client';

const NO_RESPONSIBLES: Responsible[] = [];

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
  
  // Route projectId is the source of truth; the store value covers the legacy /responsaveis route
  const params = useParams();
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const projectId = (params.projectId as string | undefined) || activeProjectId;
  const { addResponsible, updateResponsible, deleteResponsible, getLimit, projects, fetchResponsiblesForProject } = useProjectStore();
  const responsibles = useProjectStore(s => s.responsiblesByProjectId[projectId] ?? NO_RESPONSIBLES);
  const responsiblesStatus = useProjectStore(s => s.responsiblesStatusByProjectId[projectId] ?? 'idle');
  const responsiblesError = useProjectStore(s => s.responsiblesErrorByProjectId[projectId] ?? null);

  // Shares the layout's request when one is already in flight for this project
  useEffect(() => {
    if (projectId) {
      fetchResponsiblesForProject(projectId);
    }
  }, [projectId, fetchResponsiblesForProject]);

  const hasResponsibles = responsibles.length > 0;
  // Existing records stay visible while refreshing or after a failed refresh
  const contentState: 'loading' | 'error' | 'empty' | 'list' =
    hasResponsibles ? 'list'
    : responsiblesStatus === 'success' ? 'empty'
    : responsiblesStatus === 'error' ? 'error'
    : 'loading';
  const areCountsKnown = contentState === 'list' || contentState === 'empty';

  const handleRetry = () => {
    if (projectId) {
      fetchResponsiblesForProject(projectId);
    }
  };

  // Get billing entitlements for responsible limit
  const activeProjectsLimit = getLimit('activeProjects');
  const isFreePlan = typeof activeProjectsLimit === 'number';
  const hasUnlimitedProjects = activeProjectsLimit === 'unlimited';
  
  // Determine responsible limit based on plan
  const maxResponsibles = isFreePlan ? 5 : 'unlimited';
  const isLimitReached = areCountsKnown && typeof maxResponsibles === 'number' && responsibles.length >= maxResponsibles;

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

  // Responsibles are loaded by project layout - no need to fetch here

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (isEditMode && editingResponsible) {
      try {
        const { error } = await supabase
          .from('responsibles')
          .update({
            name: formData.name,
            role: formData.role,
            email: formData.email || null,
            phone: formData.phone || null,
            company: formData.company || null,
            city: formData.city.trim() || null,
          })
          .eq('id', editingResponsible.id);

        if (error) {
          console.error('Error updating responsible:', error);
          return;
        }

        updateResponsible(projectId, editingResponsible.id, {
          ...formData,
          city: formData.city.trim() || undefined
        });
      } catch (err) {
        console.error('Failed to update responsible:', err);
      }
    } else {
      if (!projectId) {
        return;
      }

      try {
        const project = projects.find(p => p.id === projectId);
        const tenantId = project?.tenant_id;

        const { data, error } = await supabase
          .from('responsibles')
          .insert({
            project_id: projectId,
            tenant_id: tenantId,
            name: formData.name,
            role: formData.role,
            email: formData.email || null,
            phone: formData.phone || null,
            company: formData.company || null,
            city: formData.city.trim() || null,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating responsible:', error);
          return;
        }

        if (data) {
          const persistedResponsible = {
            id: data.id,
            name: data.name,
            company: data.company || '',
            role: data.role,
            email: data.email || '',
            phone: data.phone || '',
            city: data.city || '',
            projectId: data.project_id,
          };
          addResponsible(projectId, persistedResponsible);
        }
      } catch (err) {
        console.error('Failed to create responsible:', err);
      }
    }

    setIsModalOpen(false);
    setEditingResponsible(null);
    setIsEditMode(false);
    setFormData({
      name: '',
      company: '',
      role: 'other',
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
      company: responsible.company || '',
      role: responsible.role,
      email: responsible.email,
      phone: responsible.phone,
      city: responsible.city || ''
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Every dismissal (Escape, backdrop, close button, Cancelar) discards the draft and the edit target,
  // with the same defaults as opening "Adicionar". Saving keeps its own close/reset logic in handleSubmit.
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingResponsible(null);
    setIsEditMode(false);
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

      <div className="space-y-6">
      {/* Section Header (Figma: title + description, primary action) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Responsáveis da Obra</h1>
          <p className="mt-1 text-sm text-gray-500">Gerir contactos dos profissionais responsáveis pela obra</p>
        </div>
        <Button
          size="sm"
          onClick={handleAddResponsible}
          disabled={isLimitReached || !areCountsKnown}
          title={isLimitReached ? `Limite de ${maxResponsibles} responsáveis atingido` : undefined}
          className="w-fit gap-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Adicionar responsável</span>
          <span className="sm:hidden">Adicionar</span>
        </Button>
      </div>

      {/* Plan usage: only plans with a numeric limit have something to count against */}
      {typeof maxResponsibles === 'number' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          {areCountsKnown ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-blue-900">
                    {responsibles.length} de {maxResponsibles} responsáveis usados
                  </p>
                  {isLimitReached && <Badge variant="destructive">Limite atingido</Badge>}
                </div>
                <p className="mt-1 text-xs text-blue-700">
                  {isLimitReached
                    ? 'Disponível no plano Pro'
                    : `Pode adicionar até ${maxResponsibles} responsáveis por projeto.`}
                </p>
              </div>
              {isLimitReached && (
                <Button size="sm" onClick={handleUpgrade}>Upgrade</Button>
              )}
            </div>
          ) : (
            <div aria-busy={contentState === 'loading'}>
              <div className="h-5 w-48 animate-pulse rounded bg-blue-100" />
              <div className="mt-1 h-4 w-32 animate-pulse rounded bg-blue-100" />
            </div>
          )}
        </div>
      )}

      {/* Refresh failed while records are already shown */}
      {contentState === 'list' && responsiblesStatus === 'error' && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{responsiblesError || 'Não foi possível carregar os responsáveis.'}</p>
          <Button variant="secondary" size="sm" onClick={handleRetry}>
            Tentar novamente
          </Button>
        </div>
      )}

      {contentState === 'loading' ? (
        <Card className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">A carregar responsáveis...</p>
        </Card>
      ) : contentState === 'error' ? (
        <Card className="p-12 text-center">
          <p className="text-red-600 font-medium mb-1">{responsiblesError || 'Não foi possível carregar os responsáveis.'}</p>
          <p className="text-sm text-gray-500 mb-4">Verifica a tua ligação e tenta novamente.</p>
          <Button variant="secondary" size="sm" onClick={handleRetry}>
            Tentar novamente
          </Button>
        </Card>
      ) : contentState === 'empty' ? (
        <Card className="px-6 py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            <Phone className="h-8 w-8 text-gray-400" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-lg font-medium text-gray-900">Nenhum responsável adicionado</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-500">
            Adicione os profissionais responsáveis pela sua obra para manter todos os contactos organizados num só lugar.
          </p>
          <Button size="sm" onClick={handleAddResponsible} disabled={isLimitReached} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar primeiro responsável
          </Button>
        </Card>
      ) : (
        <>
          {/* People cards (Figma: two columns; a third only on very wide content areas) */}
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {responsibles.map((responsible) => (
              <li key={responsible.id}>
                <Card className="h-full p-4 transition-shadow hover:shadow-md md:p-6">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div
                      aria-hidden="true"
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-base font-medium text-white sm:h-14 sm:w-14 sm:text-lg"
                    >
                      {getInitials(responsible.name)}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words text-lg font-semibold text-gray-900">{responsible.name}</h2>
                      {responsible.company && (
                        <p className="break-words text-sm text-gray-600">{responsible.company}</p>
                      )}
                      <span className={`mt-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRoleColor(responsible.role)}`}>
                        {getRoleLabel(responsible.role)}
                      </span>

                      {/* Contact details (missing optional values are not shown) */}
                      <dl className="mt-3 space-y-2 text-sm text-gray-600">
                        {responsible.email && (
                          <div className="flex items-start gap-2">
                            <dt className="sr-only">Email</dt>
                            <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
                            <dd className="min-w-0 wrap-anywhere">
                              <a href={`mailto:${responsible.email}`} className="rounded-sm text-gray-600 underline-offset-2 transition-colors hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{responsible.email}</a>
                            </dd>
                          </div>
                        )}
                        {responsible.phone && (
                          <div className="flex items-start gap-2">
                            <dt className="sr-only">Telemóvel</dt>
                            <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
                            <dd className="min-w-0 break-words">
                              {/* tel: needs the number without spaces; the displayed value is unchanged */}
                              <a href={`tel:${responsible.phone.replace(/[^\d+]/g, '')}`} className="rounded-sm text-gray-600 underline-offset-2 transition-colors hover:text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{responsible.phone}</a>
                            </dd>
                          </div>
                        )}
                        {responsible.city && (
                          <div className="flex items-start gap-2">
                            <dt className="sr-only">Cidade</dt>
                            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
                            <dd className="min-w-0 break-words">{responsible.city}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Actions (stacked on small screens so the details keep their width) */}
                    <div className="-mr-2 -mt-1 flex flex-shrink-0 flex-col gap-1 sm:flex-row">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditResponsible(responsible)}
                        aria-label={`Editar responsável: ${responsible.name}`}
                        title="Editar"
                        className="text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteResponsible(responsible)}
                        aria-label={`Eliminar responsável: ${responsible.name}`}
                        title="Eliminar"
                        className="text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {/* Summary (Figma) */}
          <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Phone className="h-5 w-5 text-blue-600" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-blue-900">
                {responsibles.length} {responsibles.length === 1 ? 'responsável adicionado' : 'responsáveis adicionados'}
              </p>
              <p className="text-xs text-blue-700">Mantenha os contactos atualizados para uma comunicação eficaz</p>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Add/Edit Responsible Modal */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={isEditMode ? 'Editar Responsável' : 'Adicionar Responsável'}
        description={
          // block + text-sm keeps the previous description size and line height
          <span className="block text-sm">
            {isEditMode
              ? 'Edite as informações do profissional responsável pela obra. Todos os campos marcados com * são obrigatórios.'
              : 'Adicione um novo profissional responsável pela obra. Todos os campos marcados com * são obrigatórios.'
            }
          </span>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome completo */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome completo *
            </label>
            <Input
              type="text"
              id="name"
              value={formData.name}
              onChange={handleInputChange('name')}
              aria-invalid={formErrors.name ? true : undefined}
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
            <Input
              type="text"
              id="company"
              value={formData.company}
              onChange={handleInputChange('company')}
              aria-invalid={formErrors.company ? true : undefined}
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
            <Select
              id="role"
              value={formData.role}
              onChange={handleInputChange('role')}
              aria-invalid={formErrors.role ? true : undefined}
            >
              <option value="architect">Arquiteto</option>
              <option value="contractor">Empreiteiro</option>
              <option value="civil_engineer">Engenheiro Civil</option>
              <option value="supervisor">Fiscalização</option>
              <option value="other">Outro</option>
            </Select>
            {formErrors.role && (
              <p className="mt-1 text-sm text-red-600">{formErrors.role}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <Input
              type="email"
              id="email"
              value={formData.email}
              onChange={handleInputChange('email')}
              aria-invalid={formErrors.email ? true : undefined}
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
            <Input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={handleInputChange('phone')}
              aria-invalid={formErrors.phone ? true : undefined}
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
            <Input
              type="text"
              id="city"
              value={formData.city}
              onChange={handleInputChange('city')}
              placeholder="Lisboa"
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
            <Button type="button" variant="outline" size="sm" onClick={handleCloseModal} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isLimitReached && !isEditMode} className="w-full sm:w-auto">
              {isEditMode ? 'Guardar Alterações' : 'Adicionar Responsável'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
