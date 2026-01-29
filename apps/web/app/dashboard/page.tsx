'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiCheckCircle, HiCurrencyDollar, HiClock, HiDocumentText, HiBanknotes, HiPlus } from 'react-icons/hi2';

import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { getActiveProjectId, mockProjects, Project } from '@/src/mocks';
import { useProjectStore } from '@/src/store/projectStore';
import ProjectHeader from '@/src/components/ProjectHeader';
import NewTaskModal from '@/components/NewTaskModal';
import AddExpenseModal from '@/components/AddExpenseModal';

type NextStep = {
  id: number;
  title: string;
  phase: string;
  deadline: string;
  completed: boolean;
};

type RecentDocument = {
  id: number;
  name: string;
  date: string;
  type: 'PDF' | 'EXCEL' | 'OTHER';
};

type ExpenseCategory = {
  name: string;
  amount: string;
  percentage: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  
  const projectId = useProjectStore(s => s.activeProjectId);
  const { getActiveProject, getNextSteps, toggleTaskCompletion, getTasksForProject, getExpensesForProject, getDocumentsForProject, addTask, addExpense } = useProjectStore();
  const activeProject = getActiveProject();
  const nextStepsTasks = getNextSteps(projectId, 5);
  const projectTasks = getTasksForProject(projectId); 
  const projectExpenses = getExpensesForProject(projectId); 
  const projectDocuments = getDocumentsForProject(projectId); 

  // Convert tasks to next steps format for UI
  const nextSteps = nextStepsTasks.map(task => ({
    id: task.id,
    title: task.title,
    phase: task.phase,
    deadline: task.dueDate || 'Sem prazo',
    completed: task.completed,
  }));

  const toggleNextStep = (taskId: string) => {
    toggleTaskCompletion(projectId, taskId);
  };

  const handleViewAllTasks = () => {
    router.push('/checklist');
  };

  const handleViewAllDocuments = () => {
    router.push('/documents');
  };

  const handleViewAllExpenses = () => {
    router.push('/expenses');
  };

  const openTaskModal = () => {
    setIsTaskModalOpen(true);
  };

  const openExpenseModal = () => {
    setIsExpenseModalOpen(true);
  };

  const handleAddTask = (newTask: {
    title: string;
    phase: string;
    dueDate?: string;
  }) => {
    addTask(projectId, newTask);
    setIsTaskModalOpen(false);
  };

  const handleAddExpense = (newExpense: {
    description: string;
    amount: number;
    date: string;
    category: string;
    supplier: string;
  }) => {
    addExpense(projectId, newExpense);
    setIsExpenseModalOpen(false);
  };

  // Calculate project data
  const completedTasks = projectTasks.filter(t => t.completed).length;
  const totalTasks = projectTasks.length;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  const totalExpenses = projectExpenses.reduce((sum, expense) => expense.amount, 0);
  const totalBudget = 50000;
  const remainingBudget = totalBudget - totalExpenses;
  const budgetPercentage = (totalExpenses / totalBudget) * 100;

  const projectData = {
    title: activeProject?.name || 'Projeto',
    subtitle: `${activeProject?.type || 'Casa'} • Fase: ${activeProject?.phase || 'planning'}`,
    checklistProgress: {
      percentage: taskProgress,
      completed: completedTasks,
      total: totalTasks,
    },
    totalExpenses: {
      amount: `€${totalExpenses.toLocaleString()}`,
      count: projectExpenses.length,
    },
    plannedBudget: {
      amount: `€${totalBudget.toLocaleString()}`,
      used: Math.round(budgetPercentage),
    },
    pendingTasks: {
      count: totalTasks - completedTasks,
    },
  };

  const recentDocuments = projectDocuments.slice(0, 3);

  // Sort expenses by date descending and take latest 4
  const recentExpenses = [...projectExpenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  const expensesByCategory: ExpenseCategory[] = [
    { name: 'Materiais', amount: '€5,000', percentage: 53 },
    { name: 'Serviços Profissionais', amount: '€3,500', percentage: 37 },
    { name: 'Legal', amount: '€1,000', percentage: 10 },
  ];

  const getFileIcon = (type: RecentDocument['type']) => {
    switch (type) {
      case 'PDF':
        return '📄';
      case 'EXCEL':
        return '📊';
      default:
        return '📄';
    }
  };

  const formatExpenseDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <AppLayout
      currentPage="dashboard"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      {/* Project Header */}
      <ProjectHeader showEditButton={true} />

      {/* Summary Cards Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Checklist Progress Card */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Progresso do Checklist</h3>
            <HiCheckCircle className="w-6 h-6 text-green-500" />
          </div>

          <div className="mb-3">
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {projectData.checklistProgress.percentage}%
            </div>
            <p className="text-sm text-gray-600">
              {projectData.checklistProgress.completed} de {projectData.checklistProgress.total} tarefas concluídas
            </p>
          </div>

          <ProgressBar current={projectData.checklistProgress.percentage} total={100} />
        </Card>

        {/* Total Expenses Card */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Despesas Totais</h3>
            <HiCurrencyDollar className="w-6 h-6 text-green-500" />
          </div>

          <div className="mb-3">
            <div className="text-3xl font-bold text-gray-900 mb-1">{projectData.totalExpenses.amount}</div>
            <p className="text-sm text-gray-600">{projectData.totalExpenses.count} lançamentos</p>
          </div>
        </Card>

        {/* Planned Budget Card */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Orçamento Planeado</h3>
            <HiCurrencyDollar className="w-6 h-6 text-green-500" />
          </div>

          <div className="mb-3">
            <div className="text-3xl font-bold text-gray-900 mb-1">{projectData.plannedBudget.amount}</div>
            <p className="text-sm text-gray-600">{projectData.plannedBudget.used}% utilizado</p>
          </div>

          <ProgressBar current={projectData.plannedBudget.used} total={100} />
        </Card>

        {/* Pending Tasks Card */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Tarefas Pendentes</h3>
            <HiClock className="w-6 h-6 text-green-500" />
          </div>

          <div className="mb-3">
            <div className="text-3xl font-bold text-gray-900 mb-1">{projectData.pendingTasks.count}</div>
            <p className="text-sm text-gray-600">tarefas para fazer</p>
          </div>
        </Card>
      </section>

      {/* Main Content Grid */}
      <div className="space-y-6">
        {/* First Row: Próximos Passos + Despesas Recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Next Steps */}
            <section >
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Próximos Passos</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={openTaskModal}
                      className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors"
                      title="Adicionar tarefa"
                    >
                      <HiPlus className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleViewAllTasks}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer transition-colors"
                    >
                      Ver tudo
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {nextSteps.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <input
                        type="checkbox"
                        checked={step.completed}
                        onChange={() => toggleNextStep(step.id)}
                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                      />

                      <div className="flex-1">
                        <h4 className={`font-medium text-gray-900 ${step.completed ? 'line-through opacity-60' : ''}`}>
                          {step.title}
                        </h4>
                        <p className={`text-sm ${step.completed ? 'text-gray-400 opacity-60' : 'text-gray-500'}`}>
                          Fase: {step.phase} · Prazo: {step.deadline}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          {/* Recent Expenses */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Despesas Recentes</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={openExpenseModal}
                  className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors"
                  title="Adicionar despesa"
                >
                  <HiPlus className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleViewAllExpenses}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer transition-colors"
                >
                  Ver tudo
                </button>
              </div>
            </div>

            <div className="space-y-3 flex-1">
              {recentExpenses.map((expense) => (
                <div key={expense.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                    <HiBanknotes className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
                    <p className="text-xs text-gray-500">{expense.category} · {formatExpenseDate(expense.date)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">€{expense.amount.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Second Row: Documentos Recentes */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Documentos Recentes</h3>
            <button 
              onClick={handleViewAllDocuments}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium cursor-pointer transition-colors"
            >
              Ver tudo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{getFileIcon(doc.type)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-500">{doc.date}</p>
                </div>
                <HiDocumentText className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Third Row: Despesas por Categoria */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Despesas por Categoria</h3>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">Ver detalhes</button>
          </div>

          <div className="space-y-4">
            {expensesByCategory.map((category) => (
              <div key={category.name}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">{category.name}</span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{category.amount}</span>
                    <span className="text-sm text-gray-500 ml-1">({category.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gray-700 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${category.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <NewTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSubmit={handleAddTask}
        defaultPhase={'Planejamento'}
      />

      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        onSubmit={handleAddExpense}
      />
    </AppLayout>
  );
}
