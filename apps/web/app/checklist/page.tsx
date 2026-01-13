'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { HiHome, HiCheckCircle, HiDocument, HiCurrencyDollar, HiDownload, HiCalendar, HiTrash, HiPlus } from 'react-icons/hi';
import { Card } from '@/components/ui/Card';
import NewTaskModal from '@/components/NewTaskModal';

type TaskPhase = 'Planejamento' | 'Design' | 'Licenças' | 'Construção' | 'Acabamentos' | 'Concluído';

type Task = {
  id: string;
  title: string;
  phase: TaskPhase;
  dueDate?: string;
  completed: boolean;
};

export default function ChecklistPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TaskPhase>('Planejamento');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      title: 'Aprovar projeto arquitetônico',
      phase: 'Planejamento',
      completed: false,
      dueDate: '01/02/2026',
    },
    {
      id: '2',
      title: 'Selecionar materiais de construção',
      phase: 'Planejamento',
      completed: false,
      dueDate: '15/02/2026',
    },
    {
      id: '3',
      title: 'Definir paleta de cores',
      phase: 'Design',
      completed: false,
      dueDate: '10/02/2026',
    },
    {
      id: '4',
      title: 'Escolher acabamentos',
      phase: 'Design',
      completed: false,
      dueDate: '20/02/2026',
    },
    {
      id: '5',
      title: 'Solicitar alvará de construção',
      phase: 'Licenças',
      completed: false,
      dueDate: '05/02/2026',
    },
    {
      id: '6',
      title: 'Obter licenças ambientais',
      phase: 'Licenças',
      completed: false,
      dueDate: '25/02/2026',
    },
  ]);

  const getTaskCounts = () => {
    const counts: Record<string, number> = {};
    const phases: TaskPhase[] = ['Planejamento', 'Design', 'Licenças', 'Construção', 'Acabamentos', 'Concluído'];
    
    phases.forEach(phase => {
      counts[phase] = tasks.filter(task => task.phase === phase).length;
    });
    
    return counts;
  };

  const taskCounts = getTaskCounts();

  const phaseTabs = [
    { id: 'Planejamento', label: 'Planejamento', count: taskCounts['Planejamento'] || 0 },
    { id: 'Design', label: 'Design', count: taskCounts['Design'] || 0 },
    { id: 'Licenças', label: 'Licenças', count: taskCounts['Licenças'] || 0 },
    { id: 'Construção', label: 'Construção', count: taskCounts['Construção'] || 0 },
    { id: 'Acabamentos', label: 'Acabamentos', count: taskCounts['Acabamentos'] || 0 },
    { id: 'Concluído', label: 'Concluído', count: taskCounts['Concluído'] || 0 },
  ];

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HiHome },
    { id: 'checklist', label: 'Checklist', icon: HiCheckCircle },
    { id: 'documents', label: 'Documentos', icon: HiDocument },
    { id: 'expenses', label: 'Despesas', icon: HiCurrencyDollar },
    { id: 'export', label: 'Exportar', icon: HiDownload },
  ];

  const currentTasks = tasks
    .filter(task => task.phase === activeTab)
    .filter(task => showCompleted || !task.completed);

  const totalPendingTasks = tasks.filter(task => !task.completed).length;

  const handleAddTask = (newTask: { title: string; phase: TaskPhase; dueDate?: string }) => {
    const task: Task = {
      id: Date.now().toString(), // Simple unique ID
      title: newTask.title,
      phase: newTask.phase,
      dueDate: newTask.dueDate,
      completed: false,
    };

    setTasks(prevTasks => [...prevTasks, task]);
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
                    onClick={() => {
                      setActiveTab(item.id as TaskPhase);
                      router.push(`/${item.id === 'dashboard' ? '' : item.id}`);
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      item.id === 'checklist'
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

        <main className="flex-1 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Checklist</h1>
              <p className="text-gray-600 text-lg">{totalPendingTasks} tarefas pendentes</p>
            </div>
            <div className="flex items-center space-x-4 mt-4 sm:mt-0">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCompleted}
                  onChange={(e) => setShowCompleted(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Mostrar concluídas</span>
              </label>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <HiPlus className="w-4 h-4" />
                <span>Nova Tarefa</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {phaseTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {currentTasks.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {phaseTabs.find(tab => tab.id === activeTab)?.label}
                </h3>
                {currentTasks.map((task) => (
                  <div key={task.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      readOnly
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <h4 className={`font-medium text-gray-900 ${task.completed ? 'line-through' : ''}`}>
                        {task.title}
                      </h4>
                      {task.dueDate && (
                        <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                          <HiCalendar className="w-4 h-4" />
                          <span>Prazo: {task.dueDate}</span>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <HiTrash className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Nenhuma tarefa encontrada nesta fase</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <NewTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddTask}
        defaultPhase={activeTab}
      />
    </div>
  );
}
