'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiMenu, HiHome, HiCheckCircle, HiCurrencyDollar, HiChartBar, HiClock, HiDocument, HiCreditCard, HiDownload, HiX } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Mock data
  const projectData = {
    title: 'Nova Construção',
    subtitle: 'Casa • Fase: planning',
    checklistProgress: {
      percentage: 33,
      completed: 2,
      total: 6,
    },
    totalExpenses: {
      amount: '€9,500',
      count: 4,
    },
    plannedBudget: {
      amount: '€50,000',
      used: 19,
    },
    pendingTasks: {
      count: 4,
    },
  };

  const nextSteps = [
    {
      id: 1,
      title: 'Aprovar projeto arquitetônico',
      phase: 'Design',
      deadline: '01/02/2026',
      completed: false,
    },
    {
      id: 2,
      title: 'Selecionar materiais de construção',
      phase: 'Planejamento',
      deadline: '15/02/2026',
      completed: false,
    },
    {
      id: 3,
      title: 'Contratar equipe de obra',
      phase: 'Planejamento',
      deadline: '28/02/2026',
      completed: true,
    },
  ];

  const recentDocuments = [
    {
      id: 1,
      name: 'Orçamento_Materiais_2024.xlsx',
      date: '15/01/2026',
      type: 'EXCEL',
    },
    {
      id: 2,
      name: 'Contrato_obra.pdf',
      date: '10/01/2026',
      type: 'PDF',
    },
    {
      id: 3,
      name: 'Alvará_construção.pdf',
      date: '05/01/2026',
      type: 'PDF',
    },
  ];

  const expensesByCategory = [
    {
      name: 'Materiais',
      amount: '€5,000',
      percentage: 53,
    },
    {
      name: 'Serviços Profissionais',
      amount: '€3,500',
      percentage: 37,
    },
    {
      name: 'Legal',
      amount: '€1,000',
      percentage: 10,
    },
  ];

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HiHome },
    { id: 'checklist', label: 'Checklist', icon: HiCheckCircle },
    { id: 'documents', label: 'Documentos', icon: HiDocument },
    { id: 'expenses', label: 'Despesas', icon: HiCurrencyDollar },
    { id: 'export', label: 'Exportar', icon: HiDownload },
  ];

  const bottomNavigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HiHome },
    { id: 'checklist', label: 'Checklist', icon: HiCheckCircle },
    { id: 'documents', label: 'Documentos', icon: HiDocument },
    { id: 'expenses', label: 'Despesas', icon: HiCurrencyDollar },
  ];

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return '📄';
      case 'EXCEL':
        return '📊';
      default:
        return '📄';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between p-4 bg-white shadow-sm md:hidden">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <HiHome className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Visão Clara</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <HiMenu className="w-6 h-6 text-gray-600" />
        </button>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <HiHome className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Visão Clara</h2>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <HiX className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            
            <nav className="p-4">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                      router.push(`/${item.id === 'dashboard' ? '' : item.id}`);
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row">
        <aside className="w-64 bg-white shadow-md hidden md:block min-h-screen">
          <div className="p-6">
            <div className="flex items-center space-x-2 mb-8">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <HiHome className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Visão Clara</h2>
            </div>
            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(`/${item.id === 'dashboard' ? '' : item.id}`)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-6 pt-20 md:pt-6">
          <section className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
              {projectData.title}
            </h2>
            <p className="text-gray-600 text-lg">{projectData.subtitle}</p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Despesas Totais</h3>
                <HiCurrencyDollar className="w-6 h-6 text-green-500" />
              </div>
              <div className="mb-3">
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {projectData.totalExpenses.amount}
                </div>
                <p className="text-sm text-gray-600">
                  {projectData.totalExpenses.count} despesas registradas
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Orçamento Planejado</h3>
                <HiChartBar className="w-6 h-6 text-purple-500" />
              </div>
              <div className="mb-3">
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {projectData.plannedBudget.amount}
                </div>
                <p className="text-sm text-gray-600">{projectData.plannedBudget.used}% utilizado</p>
              </div>
              <ProgressBar current={projectData.plannedBudget.used} total={100} />
            </Card>

            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Tarefas Pendentes</h3>
                <HiClock className="w-6 h-6 text-orange-500" />
              </div>
              <div className="mb-3">
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {projectData.pendingTasks.count}
                </div>
                <p className="text-sm text-gray-600">Tarefas a fazer</p>
              </div>
            </Card>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <section className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Próximos Passos</h3>
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Ver tudo
                  </button>
                </div>
                <div className="space-y-3">
                  {nextSteps.map((step) => (
                    <div key={step.id} className="flex items-start space-x-3 p-3">
                      <input
                        type="checkbox"
                        checked={step.completed}
                        readOnly
                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{step.title}</h4>
                        <p className="text-sm text-gray-500">
                          Fase: {step.phase} · Prazo: {step.deadline}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="lg:col-span-1">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Documentos Recentes</h3>
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Ver tudo
                  </button>
                </div>
                <div className="space-y-3">
                  {recentDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center space-x-3 p-3">
                      <div className="text-2xl">{getFileIcon(doc.type)}</div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{doc.name}</h4>
                        <p className="text-sm text-gray-500">{doc.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <section className="block lg:hidden mb-20">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Resumo de Despesas por Categoria</h3>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Ver detalhes
                </button>
              </div>
              <div className="space-y-4">
                {expensesByCategory.map((category) => (
                  <div key={category.name} className="p-0">
                    <div className="flex justify-between items-center mb-3">
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
          </section>

          <section className="hidden lg:block">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Resumo de Despesas por Categoria</h3>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Ver detalhes
                </button>
              </div>
              <div className="space-y-4">
                {expensesByCategory.map((category) => (
                  <div key={category.name} className="p-0">
                    <div className="flex justify-between items-center mb-3">
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
          </section>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden">
        <div className="grid grid-cols-4 py-2">
          {bottomNavigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  router.push(`/${item.id === 'dashboard' ? '' : item.id}`);
                }}
                className={`flex flex-col items-center py-2 space-y-1 ${
                  activeTab === item.id ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
