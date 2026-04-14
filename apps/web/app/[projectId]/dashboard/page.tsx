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
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { setActiveProjectId, addProject } = useProjectStore();
  
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

  // Load project data
  useEffect(() => {
    const loadProjectData = async () => {
      if (!projectId) {
        setError('ID do projeto não encontrado');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

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

        console.log('📊 Dashboard - Project data loaded:', projectData);
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
        setActiveProjectId(projectId);
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
        };
        addProject(projectForStore as any);

        // Load tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (tasksError) {
          console.error('Error loading tasks:', tasksError);
        } else {
          setTasks(tasksData || []);
        }

        // Load expenses
        const { data: expensesData, error: expensesError } = await supabase
          .from('expenses')
          .select('*')
          .eq('project_id', projectId)
          .order('date', { ascending: false });

        if (expensesError) {
          console.error('Error loading expenses:', expensesError);
        } else {
          setExpenses(expensesData || []);
        }

        // Load documents
        const { data: documentsData, error: documentsError } = await supabase
          .from('documents')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (documentsError) {
          console.error('Error loading documents:', documentsError);
        } else {
          setDocuments(documentsData || []);
        }

      } catch (err) {
        console.error('Error loading project data:', err);
        setError('Erro ao carregar dados do projeto');
      } finally {
        setLoading(false);
      }
    };

    loadProjectData();
  }, [projectId]);

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
        <ProjectHeader showEditButton={true} />

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{projectData.title}</h1>
          <p className="text-gray-600">{projectData.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Progresso</p>
                <p className="text-2xl font-bold text-gray-900">{projectData.checklistProgress.percentage}%</p>
              </div>
              <CheckSquare className="h-8 w-8 text-blue-600" />
            </div>
            <ProgressBar progress={projectData.checklistProgress.percentage} className="mt-4" />
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

        <div className="text-center text-gray-500">
          <p>Dashboard em desenvolvimento - dados do projeto carregados com sucesso!</p>
          <p className="text-sm mt-2">Project ID: {projectId}</p>
        </div>

        {/* Edit Project Modal */}
        <EditProjectModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={(updates: any) => {
            console.log('Project updates (not saved yet):', updates);
            // TODO: Implement backend update logic in next step
          }}
          project={project}
        />
      </div>
    </AppLayout>
  );
}
