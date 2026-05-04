'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { CheckSquare, FileText, DollarSign, TrendingUp, AlertCircle, Clock, Receipt, Plus } from 'lucide-react';

import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
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
  const { addProject, deduplicateProjects, getTasksForProject, getExpensesForProject, getDocumentsForProject } = useProjectStore();
  const { user, session, initialized } = useAuthStore();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Real data states
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load project data
  useEffect(() => {
    const loadProjectData = async () => {
      // Check if user is authenticated
      if (!initialized) {
        return;
      }
      
      if (!user || !session) {
        router.push('/auth/signin');
        return;
      }

      try {
        // Test supabase connection
        const { data: testData, error: testError } = await supabase
          .from('projects')
          .select('id')
          .limit(1);
        
        if (testError) {
          console.error('🔍 Supabase connection test failed:', testError);
          setError('Erro de conexão com Supabase');
          setLoading(false);
          return;
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

  // Sync from store to local state (layout loads data)
  useEffect(() => {
    if (!projectId) return;
    setTasks(getTasksForProject(projectId) as any);
    setExpenses(getExpensesForProject(projectId) as any);
    setDocuments(getDocumentsForProject(projectId) as any);
  }, [projectId, getTasksForProject, getExpensesForProject, getDocumentsForProject]);

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
  const completedTasks = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const totalExpenses = expenses.reduce((sum, expense) => expense.amount, 0);
  
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
      count: expenses.length,
    },
    plannedBudget: {
      amount: `EUR ${totalBudget.toLocaleString()}`,
      used: Math.round(budgetPercentage),
    },
    pendingTasks: {
      count: totalTasks - completedTasks,
    },
  };

  const recentDocuments = documents.slice(0, 3);

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

  // Rest of the dashboard component would go here...
  // For now, return a simple version
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

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Progresso</p>
                <p className="text-2xl font-bold text-gray-900">{projectData.checklistProgress.percentage}%</p>
              </div>
              <CheckSquare className="h-8 w-8 text-blue-600" />
            </div>
            <ProgressBar 
              current={projectData.checklistProgress.completed} 
              total={projectData.checklistProgress.total} 
            />
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Despesas</p>
                <p className="text-2xl font-bold text-gray-900">{projectData.totalExpenses.amount}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Orçamento</p>
                <p className="text-2xl font-bold text-gray-900">{projectData.plannedBudget.amount}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </Card>

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

        {tasks.length === 0 && expenses.length === 0 && documents.length === 0 && (
          <div className="text-center text-gray-500">
            <p>Dashboard em desenvolvimento - dados do projeto carregados com sucesso!</p>
            <p className="text-sm mt-2">Project ID: {projectId}</p>
          </div>
        )}

        {/* Edit Project Modal */}
        <EditProjectModal
          isOpen={isEditModalOpen}
          onClose={() => {
              setIsEditModalOpen(false);
              setSaveError(null);
            }}
          onSubmit={async (updates: any) => {
            if (!projectId) {
              console.error('🚨 Dashboard - projectId is missing or undefined!');
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
