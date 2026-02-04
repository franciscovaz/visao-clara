'use client';

import { useState } from 'react';
import { Calendar, Trash, Plus, Pencil, CheckSquare } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import NewTaskModal from '@/components/NewTaskModal';
import EditTaskModal from '@/components/EditTaskModal';
import AppLayout from '@/components/AppLayout';
import { useProjectStore } from '@/src/store/projectStore';
import ProjectHeader from '@/src/components/ProjectHeader';

type TaskPhase = 'Planejamento' | 'Design' | 'Licenças' | 'Construção' | 'Acabamentos' | 'Concluído';

type Task = {
  id: string;
  title: string;
  phase: TaskPhase;
  dueDate?: string;
  completed: boolean;
};

export default function ChecklistPage() {
  const [activeTab, setActiveTab] = useState<TaskPhase>('Planejamento');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const projectId = useProjectStore(s => s.activeProjectId);
  const { getTasksForProject, toggleTaskCompletion, addTask } = useProjectStore();
  const tasks = getTasksForProject(projectId);

  // Calculate task counts dynamically (exclude completed tasks)
  const getTaskCounts = () => {
    const counts: Record<string, number> = {};
    const phases: TaskPhase[] = ['Planejamento', 'Design', 'Licenças', 'Construção', 'Acabamentos', 'Concluído'];
    
    phases.forEach(phase => {
      counts[phase] = tasks.filter(task => task.phase === phase && !task.completed).length;
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

  const currentTasks = tasks
    .filter(task => task.phase === activeTab)
    .filter(task => showCompleted || !task.completed);

  const totalPendingTasks = tasks.filter(task => !task.completed).length;

  const handleAddTask = (newTask: Omit<Task, 'id' | 'completed'>) => {
    addTask(projectId, newTask);
  };

  const handleDeleteTask = (taskId: string) => {
    console.log('Delete task:', taskId);
    // TODO: Implement actual task deletion when state management is added
    // For now, just log the deletion since we're using static mock data
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const handleUpdateTask = (updatedTask: Omit<Task, 'id' | 'completed'>) => {
    if (!editingTask) return;
    
    console.log('Update task:', { id: editingTask.id, ...updatedTask });
    // TODO: Implement actual task update when state management is added
    // For now, just log the update since we're using static mock data
    
    setIsEditModalOpen(false);
    setEditingTask(null);
  };

  const handleToggleTask = (taskId: string) => {
    toggleTaskCompletion(projectId, taskId);
  };

  return (
    <AppLayout 
      currentPage="checklist"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      {/* Project Header */}
      <ProjectHeader />

      {/* Header */}
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
            <Plus className="w-4 h-4" />
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
                  onChange={() => handleToggleTask(task.id)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex-1">
                  <h4 className={`font-medium text-gray-900 ${task.completed ? 'line-through opacity-60' : ''}`}>
                    {task.title}
                  </h4>
                  {task.dueDate && (
                    <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                      <Calendar className="w-4 h-4" />
                      <span className={task.completed ? 'opacity-60' : ''}>Prazo: {task.dueDate}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => handleEditTask(task)}
                    className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Sem tarefas no checklist</p>
            <p className="text-xs text-gray-400 mt-1">As tarefas do projeto irão aparecer aqui.</p>
          </div>
        )}
      </div>

      {/* New Task Modal */}
      <NewTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddTask}
        defaultPhase={activeTab}
      />

      <EditTaskModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleUpdateTask}
        task={editingTask}
      />
    </AppLayout>
  );
}
