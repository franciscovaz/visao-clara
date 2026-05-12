'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { CheckSquare, FileText, DollarSign, TrendingUp, AlertCircle, Clock, Receipt, Plus } from 'lucide-react';

import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { Task } from '@/src/mocks/tasks';
import ProjectHeader from '@/src/components/ProjectHeader';
import NewTaskModal from '@/components/NewTaskModal';
import AddExpenseModal from '@/components/AddExpenseModal';
import EditProjectModal from '@/components/EditProjectModal';
import { useProjectStore } from '@/src/store/projectStore';
import { useAuthStore } from '@/src/store/authStore';
import { formatDate, sortDatesDescending } from '@/src/utils/dateUtils';
import { supabase } from '../../../lib/supabase/client';

type Project = {
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

type TaskItem = {
  id: string;
  title: string;
  phase: string;
  completed: boolean;
  dueDate?: string;
  project_id: string;
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  date: string;
  project_id: string;
  category?: string;
};

export default function ProjectDashboardPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const router = useRouter();
  const { addProject, deduplicateProjects, getTasksForProject, getExpensesForProject, getDocumentsForProject, setTasksForProject, setExpensesForProject, setDocumentsForProject } = useProjectStore();
  const { user, session, initialized } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Real data states
  const [project, setProject] = useState<Project | null>(null);
  const [syncedTasks, setSyncedTasks] = useState<TaskItem[]>([]);
  const [syncedExpenses, setSyncedExpenses] = useState<Expense[]>([]);
  const [syncedDocuments, setSyncedDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load project data
  useEffect(() => {
    const loadProjectData = async () => {
      console.log('[Dashboard] projectId:', projectId);
      
      // Check if user is authenticated
      if (!initialized) {
        console.log('[Dashboard] auth not initialized, returning');
        return;
      }
      
      if (!user || !session) {
        console.log('[Dashboard] no user/session, redirecting to signin');
        router.push('/auth/signin');
        return;
      }

      try {
          // Fetch tasks directly
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });
        if (tasksData) {
          const mappedTasks = tasksData.map(task => ({
            id: task.id,
            title: task.title,
            phase: task.phase,
            dueDate: task.due_date,
            completed: task.completed,
            project_id: task.project_id,
          }));
          setSyncedTasks(mappedTasks);
          setTasksForProject(projectId, mappedTasks);
        }
        
        // Fetch expenses directly
        console.log('[Dashboard] fetching expenses...');
        const { data: expensesData, error: expensesError } = await supabase
          .from('expenses')
          .select('*')
          .eq('project_id', projectId)
          .order('expense_date', { ascending: false });
        if (expensesData) {
          const mappedExpenses = expensesData.map(expense => ({
            id: expense.id,
            description: expense.description || expense.title,
            amount: expense.amount_cents / 100,
            date: expense.expense_date,
            category: expense.category,
            supplier: expense.supplier_name,
            warrantyExpiresAt: expense.warranty_expires_at,
            project_id: expense.project_id,
          }));
          setSyncedExpenses(mappedExpenses);
          setExpensesForProject(projectId, mappedExpenses);
        }
        
        // Fetch documents directly
        console.log('[Dashboard] fetching documents...');
        const { data: documentsData, error: documentsError } = await supabase
          .from('documents')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });
        if (documentsData) {
          const mappedDocuments = documentsData.map(doc => ({
            id: doc.id,
            name: doc.title,
            date: doc.issued_on
              ? new Date(doc.issued_on).toLocaleDateString('pt-PT')
              : new Date(doc.created_at).toLocaleDateString('pt-PT'),
            type: doc.doc_type,
            phase: doc.category || '',
            supplierName: doc.supplier_name || '',
            projectId: doc.project_id,
          }));
          setSyncedDocuments(mappedDocuments);
          setDocumentsForProject(projectId, mappedDocuments);
        }

        // Load project
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (projectError) {
          console.error('Error loading project:', projectError);
          setError('Erro ao carregar projeto');
          return;
        }

        setProject(projectData);

        // Personalize project data with onboarding info
        const projectTypeLabel = projectData.project_type === 'other' 
          ? projectData.project_description || 'Projeto'
          : projectData.project_type === 'new-construction' ? 'Nova Construção'
          : projectData.project_type === 'renovation' ? 'Renovação'
          : projectData.project_type === 'purchase-with-works' ? 'Compra + Obras'
          : projectData.project_type === 'investment' ? 'Investimento'
          : 'Projeto';
          
        const propertyTypeLabel = projectData.property_type === 'house' ? 'Casa' 
          : projectData.property_type === 'apartment' ? 'Apartamento'
          : projectData.property_description || 'Imóvel';
          
        let phaseLabel = 'Planeamento';
        if (projectData.current_phase === 'design') phaseLabel = 'Design';
        else if (projectData.current_phase === 'licenses') phaseLabel = 'Licenças';
        else if (projectData.current_phase === 'construction') phaseLabel = 'Construção';
        else if (projectData.current_phase === 'finishing') phaseLabel = 'Acabamentos';
        else if (projectData.current_phase === 'completed') phaseLabel = 'Concluído';

        // Populate projectStore with real project data for ProjectHeader
        // Note: setActiveProjectId is handled by the [projectId] layout
        const projectForStore = {
          id: projectData.id,
          name: projectData.name,
          type: projectTypeLabel,
          phase: phaseLabel,
          // Add other required fields for Project interface
          description: projectData.project_description || '',
          status: projectData.status,
          created_at: projectData.created_at,
          updated_at: projectData.updated_at,
          tenant_id: projectData.tenant_id,
          created_by: projectData.created_by,
          // Add backend fields
          budget: projectData.budget || '',
          propertyType: projectData.property_type || '',
          mainGoal: projectData.goal || '',
          // Map snake_case to camelCase for compatibility
          project_type: projectData.project_type,
          property_type: projectData.property_type,
          current_phase: projectData.current_phase,
          goal: projectData.goal,
        };
        addProject(projectForStore as any);
        
        // Clean up any duplicate projects in store
        deduplicateProjects();

        // Tasks, expenses, documents are loaded by project layout - no need to fetch here

      } catch (err) {
        console.error('Error loading project data:', err);
        setError('Erro ao carregar dados do projeto');
      } finally {
        setLoading(false);
      }
    };
    
    loadProjectData();
  }, [projectId, user, session, initialized, addProject, deduplicateProjects]);


  // Personalize project data with onboarding info
  const projectTypeLabel = project?.project_type === 'other' 
    ? project?.project_description || 'Projeto'
    : project?.project_type === 'new-construction' ? 'Nova Construção'
    : project?.project_type === 'renovation' ? 'Renovação'
    : project?.project_type === 'purchase-with-works' ? 'Compra + Obras'
    : project?.project_type === 'investment' ? 'Investimento'
    : 'Projeto';
    
  const propertyTypeLabel = project?.property_type === 'house' ? 'Casa' 
    : project?.property_type === 'apartment' ? 'Apartamento'
    : project?.property_description || 'Imóvel';
    
  let phaseLabel = 'Planeamento';
  if (project?.current_phase === 'design') phaseLabel = 'Design';
  else if (project?.current_phase === 'licenses') phaseLabel = 'Licenças';
  else if (project?.current_phase === 'construction') phaseLabel = 'Construção';
  else if (project?.current_phase === 'finishing') phaseLabel = 'Acabamentos';
  else if (project?.current_phase === 'completed') phaseLabel = 'Concluído';

  // Calculate project data
  const completedTasks = syncedTasks.filter(t => t.completed).length;
  const totalTasks = syncedTasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const totalExpenses = syncedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Use onboarding budget if available, otherwise default
  const totalBudget = project?.budget 
    ? parseInt(project.budget.replace(/[^\d]/g, '')) || 50000
    : 50000;
  const remainingBudget = totalBudget - totalExpenses;
  const budgetPercentage = (totalExpenses / totalBudget) * 100;

  const projectData = {
    title: project?.name || projectTypeLabel,
    subtitle: `${propertyTypeLabel} · Fase: ${phaseLabel}`,
    checklistProgress: {
      percentage: taskProgress,
      completed: completedTasks,
      total: totalTasks,
    },
    totalExpenses: {
      amount: `EUR ${totalExpenses.toLocaleString()}`,
      count: syncedExpenses.length,
    },
    plannedBudget: {
      amount: `EUR ${totalBudget.toLocaleString()}`,
      used: Math.round(budgetPercentage),
    },
    pendingTasks: {
      count: totalTasks - completedTasks,
    },
  };

  const recentDocuments = syncedDocuments
    .sort((a, b) => {
      const dateA = a.issued_on || a.created_at || '';
      const dateB = b.issued_on || b.created_at || '';
      return dateB.localeCompare(dateA);
    })
    .slice(0, 3);

  const upcomingTasks = syncedTasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      const dateA = a.dueDate || a.created_at || '';
      const dateB = b.dueDate || b.created_at || '';
      return dateA.localeCompare(dateB);
    })
    .slice(0, 4);

  const recentExpenses = syncedExpenses
    .sort((a, b) => {
      const dateA = a.date || a.created_at || '';
      const dateB = b.date || b.created_at || '';
      return dateB.localeCompare(dateA);
    })
    .slice(0, 4);

  const expensesByCategory = syncedExpenses.reduce((acc, expense) => {
    const category = expense.category || 'Outros';
    acc[category] = (acc[category] || 0) + (expense.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  // Loading state
  if (loading) {
    return (
      <AppLayout 
        currentPage="dashboard"
        showMobileMenu={isMobileMenuOpen}
        onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">A carregar dados do projeto...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <AppLayout 
        currentPage="dashboard"
        showMobileMenu={isMobileMenuOpen}
        onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar projeto</h2>
            <p className="text-gray-600 mb-4">{error || 'Projeto não encontrado'}</p>
            <button 
              onClick={() => router.push('/login')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Voltar para o login
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout 
      currentPage="dashboard"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Project Header */}
        <ProjectHeader 
          showEditButton={true}
          onEdit={() => setIsEditModalOpen(true)}
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Checklist Progress Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Progresso Checklist</p>
                <p className="text-2xl font-bold text-gray-900">{projectData.checklistProgress.percentage}%</p>
                <p className="text-sm text-gray-500">{projectData.checklistProgress.completed} de {projectData.checklistProgress.total} tarefas</p>
              </div>
              <CheckSquare className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-4">
              <ProgressBar progress={projectData.checklistProgress.percentage} />
            </div>
          </Card>

          {/* Total Expenses Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Despesas</p>
                <p className="text-2xl font-bold text-gray-900">{projectData.totalExpenses.amount}</p>
                <p className="text-sm text-gray-500">{projectData.totalExpenses.count} despesas</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </Card>

          {/* Budget Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Orçamento</p>
                <p className="text-2xl font-bold text-gray-900">{projectData.plannedBudget.amount}</p>
                <p className="text-sm text-gray-500">{projectData.plannedBudget.used}% utilizado</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-4">
              <ProgressBar progress={projectData.plannedBudget.used} color="bg-purple-600" />
            </div>
          </Card>

          {/* Pending Tasks Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tarefas Pendentes</p>
                <p className="text-2xl font-bold text-gray-900">{projectData.pendingTasks.count}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Next Steps Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <h2 className="text-lg font-semibold text-gray-900">Próximos Passos</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsTaskModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
          {upcomingTasks.length > 0 ? (
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <span className="text-gray-900">{task.title}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-PT') : 'Sem data'}
                  </span>
                </div>
              ))}
              <button 
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 mt-2"
                onClick={() => router.push(`/${projectId}/checklist`)}
              >
                Ver tudo
              </button>
            </div>
          ) : (
            <EmptyState
              title="Sem tarefas pendentes"
              description="Não há tarefas próximas do prazo."
              icon={<CheckSquare className="h-12 w-12 text-gray-400" />}
            />
          )}
        </Card>

        {/* Recent Expenses Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">Despesas Recentes</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsExpenseModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
          {recentExpenses.length > 0 ? (
            <div className="space-y-3">
              {recentExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-gray-900">{expense.description}</span>
                    <span className="text-sm text-gray-500 block">{expense.category}</span>
                  </div>
                  <span className="font-medium text-gray-900">EUR {expense.amount.toLocaleString()}</span>
                </div>
              ))}
              <button 
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 mt-2"
                onClick={() => router.push(`/${projectId}/expenses`)}
              >
                Ver tudo
              </button>
            </div>
          ) : (
            <EmptyState
              title="Sem despesas"
              description="Não há despesas registadas recentemente."
              icon={<DollarSign className="h-12 w-12 text-gray-400" />}
            />
          )}
        </Card>
      </div>

      {/* Documents Section */}
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Documentos Recentes</h2>
          </div>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/${projectId}/documents`)}>
            Ver tudo
          </Button>
        </div>
        {recentDocuments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentDocuments.map((doc) => (
              <div key={doc.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <FileText className="h-8 w-8 text-blue-600 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                    <p className="text-xs text-gray-500">{doc.type}</p>
                    <p className="text-xs text-gray-400 mt-1">{doc.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Sem documentos"
            description="Não há documentos recentes."
            icon={<FileText className="h-12 w-12 text-gray-400" />}
          />
        )}
      </Card>

      {/* Expenses by Category Section */}
      {Object.keys(expensesByCategory).length > 0 && (
        <Card className="p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Resumo de Despesas por Categoria</h2>
          </div>
          <div className="space-y-4">
            {Object.entries(expensesByCategory).map(([category, amount]) => {
              const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
              return (
                <div key={category}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{category}</span>
                    <span className="text-sm text-gray-900">EUR {amount.toLocaleString()} ({Math.round(percentage)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Global Fallback */}
      {syncedTasks.length === 0 && syncedExpenses.length === 0 && syncedDocuments.length === 0 && (
        <div className="text-center text-gray-500 mt-8 py-12">
          <p>Dashboard em desenvolvimento - dados do projeto carregados com sucesso!</p>
          <p className="text-sm mt-2">Project ID: {projectId}</p>
        </div>
      )}
        <EditProjectModal
          isOpen={isEditModalOpen}
          onClose={() => {
              setIsEditModalOpen(false);
              setSaveError(null);
            }}
          onSubmit={async (updates: any) => {
            if (!projectId) {
              return;
            }

            try {
              setIsSavingProject(true);
              setSaveError(null);
              
              // Map frontend field names to backend column names
              const backendUpdates = {
                name: updates.name,
                project_type: updates.project_type,
                property_type: updates.property_type,
                goal: updates.goal,
                budget: updates.budget,
                project_description: updates.project_description,
                current_phase: updates.current_phase,
                updated_at: new Date().toISOString(),
              };
              
              const { data, error } = await supabase
                .from('projects')
                .update(backendUpdates)
                .eq('id', projectId)
                .select()
                .single();
              
              if (error) {
                console.error('🎯 Dashboard - Error updating project:', error);
                throw error;
              }
              
              // Update local state
              setProject(data);
              
              // Update store
              const { updateProject } = useProjectStore.getState();
              updateProject(projectId, {
                ...data,
                type: data.project_type === 'other' ? data.project_description : data.project_type,
                phase: data.current_phase,
                budget: data.budget,
                propertyType: data.property_type,
                mainGoal: data.goal,
              });
              
              setIsEditModalOpen(false); // Close modal on success
            } catch (error: any) {
              console.error('🎯 Dashboard - Failed to save project:', error);
              setSaveError(error?.message || 'Erro ao guardar alterações');
            } finally {
              setIsSavingProject(false);
            }
          }}
          project={project}
          isSubmitting={isSavingProject}
          error={saveError}
        />
      </div>
    </AppLayout>
  );
}
