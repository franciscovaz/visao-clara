'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { CheckSquare, FileText, DollarSign, TrendingUp, AlertCircle, Clock, Receipt, type LucideIcon } from 'lucide-react';

import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { TaskPhaseDB, PHASE_LABELS } from '@/src/mocks/tasks';
import ProjectHeader from '@/src/components/ProjectHeader';
import EditProjectModal from '@/components/EditProjectModal';
import { useProjectStore } from '@/src/store/projectStore';
import { useAuthStore } from '@/src/store/authStore';
import { supabase } from '../../../lib/supabase/client';
import { cn } from '@/lib/utils';

// Dashboard display only: values and calculations stay in euros as numbers
const eurFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

// Date-only ISO values (YYYY-MM-DD) shown as pt-PT dates, built in local time so the day never shifts
const formatDatePt = (value?: string | null): string => {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('pt-PT');
};

// Figma section header: plain title with a subtle ghost "Ver tudo" action
function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {onViewAll && (
        <Button variant="ghost" size="sm" onClick={onViewAll} className="-mr-2 h-8 flex-shrink-0 px-3">
          Ver tudo
        </Button>
      )}
    </div>
  );
}

type KpiCardProps = {
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  value: string;
  caption: string;
  children?: React.ReactNode;
};

// Figma KPI card: small title with a small coloured icon, prominent value, caption, optional thin progress bar
function KpiCard({ title, icon: Icon, iconClassName, value, caption, children }: KpiCardProps) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', iconClassName)} aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900 tabular-nums wrap-anywhere">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{caption}</p>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}

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
  due_date?: string;
  created_at?: string;
  project_id: string;
};

type Expense = {
  id: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  created_at?: string;
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
  
  const [project, setProject] = useState<Project | null>(null);
  const [syncedTasks, setSyncedTasks] = useState<TaskItem[]>([]);
  const [syncedExpenses, setSyncedExpenses] = useState<Expense[]>([]);
  const [syncedDocuments, setSyncedDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleToggleTask = async (taskId: string) => {
    try {
      const task = syncedTasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedTask = { ...task, completed: !task.completed };
      setSyncedTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));

      const { error } = await supabase
        .from('tasks')
        .update({ 
          completed: !task.completed 
        })
        .eq('id', taskId)
        .eq('project_id', projectId);

      if (error) {
        console.error('Failed to toggle task:', error);
        setSyncedTasks(prev => prev.map(t => t.id === taskId ? task : t));
      }
    } catch (err) {
      console.error('Error toggling task:', err);
    }
  };

  useEffect(() => {
    const loadProjectData = async () => {
      
      if (!initialized) {
        return;
      }
      
      if (!user || !session) {
        router.push('/login');
        return;
      }

      try {
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
            due_date: task.due_date,
            created_at: task.created_at,
            completed: task.completed,
            project_id: task.project_id,
          }));
          setSyncedTasks(mappedTasks as any);
          setTasksForProject(projectId, mappedTasks as any);
        }
        
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
          }));
          setSyncedExpenses(mappedExpenses as any);
          setExpensesForProject(projectId, mappedExpenses as any);
        }
        
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
          setSyncedDocuments(mappedDocuments as any);
          setDocumentsForProject(projectId, mappedDocuments as any);
        }

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

        const projectForStore = {
          id: projectData.id,
          name: projectData.name,
          type: projectTypeLabel,
          phase: phaseLabel,
          description: projectData.project_description || '',
          status: projectData.status,
          created_at: projectData.created_at,
          updated_at: projectData.updated_at,
          tenant_id: projectData.tenant_id,
          created_by: projectData.created_by,
          budget: projectData.budget || '',
          propertyType: projectData.property_type || '',
          mainGoal: projectData.goal || '',
          project_type: projectData.project_type,
          property_type: projectData.property_type,
          current_phase: projectData.current_phase,
          goal: projectData.goal,
        };
        addProject(projectForStore as any);
        
        deduplicateProjects();


      } catch (err) {
        console.error('Error loading project data:', err);
        setError('Erro ao carregar dados do projeto');
      } finally {
        setLoading(false);
      }
    };
    
    loadProjectData();
  }, [projectId, user, session, initialized, addProject, deduplicateProjects]);


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

  const completedTasks = syncedTasks.filter(t => t.completed).length;
  const totalTasks = syncedTasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const totalExpenses = syncedExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  const totalBudget = project?.budget 
    ? parseInt(project.budget.replace(/[^\d]/g, '')) || 50000
    : 50000;
  const remainingBudget = totalBudget - totalExpenses;
  const budgetPercentage = (totalExpenses / totalBudget) * 100;
  // The alert only uses a real budget: totalBudget above falls back to 50000 when the project has none
  const hasValidBudget = (project?.budget ? parseInt(project.budget.replace(/[^\d]/g, '')) || 0 : 0) > 0;
  const showBudgetAlert = hasValidBudget && budgetPercentage > 80;
  // Display only: round up to 2 decimals (after trimming float noise) so 80.003% reads "80,01%", never "80%"
  const budgetAlertPercentage = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(
    Math.ceil(Number((budgetPercentage * 100).toFixed(6))) / 100
  );
  const isProjectEmpty = syncedTasks.length === 0 && syncedExpenses.length === 0 && syncedDocuments.length === 0;

  const projectData = {
    title: project?.name || projectTypeLabel,
    subtitle: `${propertyTypeLabel} · Fase: ${phaseLabel}`,
    checklistProgress: {
      percentage: taskProgress,
      completed: completedTasks,
      total: totalTasks,
    },
    totalExpenses: {
      amount: eurFormatter.format(totalExpenses),
      count: syncedExpenses.length,
    },
    plannedBudget: {
      amount: eurFormatter.format(totalBudget),
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
      const dateA = a.due_date || a.created_at || '';
      const dateB = b.due_date || b.created_at || '';
      return dateA.localeCompare(dateB);
    })
    .slice(0, 4);

  const recentExpenses = syncedExpenses
    .sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA);
    })
    .slice(0, 4);

  const expensesByCategory = syncedExpenses.reduce((acc, expense) => {
    const category = expense.category || 'Outros';
    acc[category] = (acc[category] || 0) + (expense.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (loading) {
    return (
      <AppLayout 
        currentPage="dashboard"
        showMobileMenu={isMobileMenuOpen}
        onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
      >
        <div>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">A carregar dados do projeto...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !project) {
    return (
      <AppLayout 
        currentPage="dashboard"
        showMobileMenu={isMobileMenuOpen}
        onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
        onMobileMenuClose={() => setIsMobileMenuOpen(false)}
      >
        <div>
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
      <div className="space-y-6">
        <ProjectHeader
          showEditButton={true}
          onEdit={() => setIsEditModalOpen(true)}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Progresso do Checklist"
            icon={CheckSquare}
            iconClassName="text-blue-600"
            value={`${projectData.checklistProgress.percentage}%`}
            caption={`${projectData.checklistProgress.completed} de ${projectData.checklistProgress.total} tarefas concluídas`}
          >
            <ProgressBar
              current={projectData.checklistProgress.completed}
              total={projectData.checklistProgress.total}
              label="Progresso do checklist"
              showLabel={false}
            />
          </KpiCard>

          <KpiCard
            title="Despesas Totais"
            icon={DollarSign}
            iconClassName="text-green-600"
            value={projectData.totalExpenses.amount}
            caption={`${projectData.totalExpenses.count} despesas registadas`}
          />

          <KpiCard
            title="Orçamento Planeado"
            icon={TrendingUp}
            iconClassName="text-purple-600"
            value={projectData.plannedBudget.amount}
            caption={`${Math.round((totalExpenses / totalBudget) * 100)}% utilizado`}
          >
            <ProgressBar
              current={Math.round((totalExpenses / totalBudget) * 100)}
              total={100}
              label="Orçamento utilizado"
              showLabel={false}
            />
          </KpiCard>

          <KpiCard
            title="Tarefas Pendentes"
            icon={Clock}
            iconClassName="text-orange-600"
            value={String(projectData.pendingTasks.count)}
            caption="Tarefas a fazer"
          />
        </div>

        {/* A project with no data shows only the dashboard EmptyState below, not one per section */}
        {!isProjectEmpty && (
          <>
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <SectionHeader title="Próximos Passos" onViewAll={() => router.push(`/${projectId}/checklist`)} />
                {upcomingTasks.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingTasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggleTask(task.id)}
                          aria-label={`Marcar "${task.title}" como concluída`}
                          className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`break-words text-sm font-medium text-gray-900 ${task.completed ? 'line-through opacity-60' : ''}`}>
                            {task.title}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Fase: {PHASE_LABELS[task.phase as TaskPhaseDB] ?? task.phase}
                            {' • '}Prazo: {task.due_date ? formatDatePt(task.due_date) : 'Sem prazo'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Sem tarefas pendentes"
                    description="Não há tarefas próximas do prazo."
                    icon={<CheckSquare className="h-8 w-8 text-gray-400" />}
                  />
                )}
              </Card>

              <Card>
                <SectionHeader title="Despesas Recentes" onViewAll={() => router.push(`/${projectId}/expenses`)} />
                {recentExpenses.length > 0 ? (
                  <div className="space-y-3">
                    {recentExpenses.map((expense) => (
                      <div key={expense.id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                        <Receipt className="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900" title={expense.description}>
                            {expense.description}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {[expense.category, formatDatePt(expense.date)].filter(Boolean).join(' • ')}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-sm font-semibold text-gray-900 tabular-nums">
                          {eurFormatter.format(expense.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Sem despesas"
                    description="Não há despesas registadas recentemente."
                    icon={<Receipt className="h-8 w-8 text-gray-400" />}
                  />
                )}
              </Card>
            </div>

            <Card>
              <SectionHeader title="Documentos Recentes" onViewAll={() => router.push(`/${projectId}/documents`)} />
              {recentDocuments.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {recentDocuments.map((doc) => (
                    <div key={doc.id} className="flex min-w-0 items-center gap-3 rounded-lg bg-gray-50 p-3">
                      <FileText className="h-5 w-5 flex-shrink-0 text-blue-600" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900" title={doc.name}>{doc.name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {[doc.type, doc.date].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Sem documentos"
                  description="Não há documentos recentes."
                  icon={<FileText className="h-8 w-8 text-gray-400" />}
                />
              )}
            </Card>

            {topCategories.length > 0 && (
              <Card>
                <SectionHeader title="Resumo de Despesas por Categoria" onViewAll={() => router.push(`/${projectId}/expenses`)} />
                <div className="space-y-4">
                  {topCategories.map(([category, amount]) => {
                    const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium text-gray-900">{category}</span>
                          <span className="flex-shrink-0 text-sm text-gray-500 tabular-nums">
                            {eurFormatter.format(amount)} ({Math.round(percentage)}%)
                          </span>
                        </div>
                        <ProgressBar current={amount} total={totalExpenses} label={category} showLabel={false} />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

          </>
        )}

        {showBudgetAlert && (
          <Card role="status" className="border-orange-200 bg-orange-50">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" aria-hidden="true" />
              <div>
                <p className="font-medium text-orange-900">Atenção ao orçamento</p>
                <p className="mt-1 text-sm text-orange-700">
                  Já utilizou {budgetAlertPercentage}% do orçamento planeado. Considere rever as despesas futuras.
                </p>
              </div>
            </div>
          </Card>
        )}

        {isProjectEmpty && (
          <Card>
            <EmptyState
              title="Ainda não há dados neste projeto"
              description="Adicione tarefas no Checklist, registe despesas e carregue documentos para ver aqui o resumo do projeto."
              icon={<CheckSquare className="h-8 w-8 text-gray-400" />}
            />
          </Card>
        )}

        <EditProjectModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setSaveError(null);
            setIsEditModalOpen(false);
          }}
          onSubmit={async (updates: any) => {
            if (!projectId) {
              return;
            }

            try {
              setIsSavingProject(true);
              setSaveError(null);
              
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
              
              setProject(data);
              
              const { updateProject } = useProjectStore.getState();
              updateProject(projectId, {
                ...data,
                type: data.project_type === 'other' ? data.project_description : data.project_type,
                phase: data.current_phase,
                budget: data.budget,
                propertyType: data.property_type,
                mainGoal: data.goal,
              });

              setIsEditModalOpen(false);
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
