'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Calendar, Trash, Plus, Pencil, CheckSquare, Sparkles, Wand2, Crown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import NewTaskModal from '@/components/NewTaskModal';
import EditTaskModal from '@/components/EditTaskModal';
import AppLayout from '@/components/AppLayout';
import { useProjectStore } from '@/src/store/projectStore';
import ProjectHeader from '@/src/components/ProjectHeader';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/src/store/authStore';

// Database-safe phase values (must match tasks_phase_check constraint)
type TaskPhaseDB = 'planning' | 'design' | 'licensing' | 'construction' | 'finishes' | 'general' | 'done';

// Display labels in Portuguese
const PHASE_LABELS: Record<TaskPhaseDB, string> = {
  planning: 'Planeamento',
  design: 'Design',
  licensing: 'Licenças',
  construction: 'Construção',
  finishes: 'Acabamentos',
  general: 'Geral',
  done: 'Concluído',
};

// All phases as array for UI use
const PHASES: TaskPhaseDB[] = ['planning', 'design', 'licensing', 'construction', 'finishes', 'general', 'done'];

type Task = {
  id: string;
  title: string;
  phase: TaskPhaseDB;
  dueDate?: string;
  completed: boolean;
};

type AISuggestion = {
  id: string;
  title: string;
  phase: TaskPhaseDB;
  priority: 'Alta' | 'Média' | 'Baixa';
  reason: string;
};

type AIUsage = { used: number; limit: number; remaining: number };

type AIUsageState =
  | { status: 'loading'; usage: null }
  | { status: 'success'; usage: AIUsage }
  | { status: 'error'; usage: null };

// The backend reports -1 when usage could not be read after a generation
const parseAIUsage = (value: unknown): AIUsage | null => {
  const usage = value as Partial<AIUsage> | null | undefined;
  if (
    !usage ||
    typeof usage.used !== 'number' || usage.used < 0 ||
    typeof usage.limit !== 'number' || usage.limit < 0 ||
    typeof usage.remaining !== 'number' || usage.remaining < 0
  ) {
    return null;
  }
  return { used: usage.used, limit: usage.limit, remaining: usage.remaining };
};

const NO_TASKS: Task[] = [];

export default function ChecklistPage() {
  const router = useRouter();
  const params = useParams();
  // Route projectId is the source of truth; the store value covers the legacy /checklist route
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const projectId = (params.projectId as string | undefined) || activeProjectId;
  const [activeTab, setActiveTab] = useState<TaskPhaseDB>('planning');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // AI Suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [selectedAiPhase, setSelectedAiPhase] = useState<TaskPhaseDB>('planning');
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState<string | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [createTaskError, setCreateTaskError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiUsageState, setAiUsageState] = useState<AIUsageState>({ status: 'loading', usage: null });
  const [isAddingTasks, setIsAddingTasks] = useState(false);
  const [taskCreationError, setTaskCreationError] = useState<string | null>(null);

  const { toggleTaskCompletion, addTask, updateTask, fetchTasksForProject } = useProjectStore();
  const tasks = useProjectStore(s => (s.tasksByProjectId[projectId] as Task[] | undefined) ?? NO_TASKS);
  const tasksStatus = useProjectStore(s => s.tasksStatusByProjectId[projectId] ?? 'idle');
  const tasksError = useProjectStore(s => s.tasksErrorByProjectId[projectId] ?? null);

  // Shares the layout's request when one is already in flight for this project
  useEffect(() => {
    if (projectId) {
      fetchTasksForProject(projectId);
    }
  }, [projectId, fetchTasksForProject]);

  const hasTasks = tasks.length > 0;
  // Existing tasks stay visible while refreshing or after a failed refresh
  const tasksContentState: 'loading' | 'error' | 'ready' =
    hasTasks || tasksStatus === 'success' ? 'ready'
    : tasksStatus === 'error' ? 'error'
    : 'loading';
  const areTaskCountsKnown = tasksContentState === 'ready';

  const handleRetryTasks = () => {
    if (projectId) {
      fetchTasksForProject(projectId);
    }
  };

  // AI usage is backend-owned: only confirmed values are shown
  const aiUsage = aiUsageState.status === 'success' ? aiUsageState.usage : null;
  const hasReachedLimit = !!aiUsage && aiUsage.used >= aiUsage.limit;

  // Calculate task counts dynamically (exclude completed tasks)
  const getTaskCounts = () => {
    const counts: Record<string, number> = {};
    
    PHASES.forEach(phase => {
      counts[PHASE_LABELS[phase]] = tasks.filter(task => task.phase === phase && !task.completed).length;
    });
    
    return counts;
  };

  const taskCounts = getTaskCounts();

  const phaseTabs = PHASES.map(phase => ({
    id: phase,
    label: PHASE_LABELS[phase],
    count: taskCounts[PHASE_LABELS[phase]] || 0,
  }));

  const currentTasks = tasks
    .filter(task => task.phase === activeTab)
    .filter(task => showCompleted || !task.completed);

  const totalPendingTasks = tasks.filter(task => !task.completed).length;

  const { user, initialized: authInitialized } = useAuthStore();
  const userId = user?.id;

  // Each usage update gets an id; responses from older requests are ignored
  const aiUsageRequestIdRef = useRef(0);

  const applyAIUsage = (usage: AIUsage) => {
    aiUsageRequestIdRef.current += 1;
    setAiUsageState({ status: 'success', usage });
  };

  const loadAIUsage = useCallback(async () => {
    if (!projectId) return;

    const requestId = ++aiUsageRequestIdRef.current;
    setAiUsageState({ status: 'loading', usage: null });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-checklist-suggestions?project_id=${projectId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error(`Usage request failed with status ${response.status}`);

      const data = await response.json();
      const usage = data.ok ? parseAIUsage(data.usage) : null;
      if (!usage) throw new Error('Invalid usage response');

      if (requestId === aiUsageRequestIdRef.current) {
        setAiUsageState({ status: 'success', usage });
      }
    } catch (error) {
      console.error('[Checklist] Failed to fetch AI usage:', error);
      if (requestId === aiUsageRequestIdRef.current) {
        setAiUsageState({ status: 'error', usage: null });
      }
    }
  }, [projectId]);

  // Reload usage when the user or project changes (the endpoint checks project access)
  useEffect(() => {
    if (userId) {
      loadAIUsage();
    } else if (authInitialized) {
      aiUsageRequestIdRef.current += 1;
      setAiUsageState({ status: 'error', usage: null });
    }
  }, [loadAIUsage, userId, authInitialized]);

  const handleAddTask = async (newTask: Omit<Task, 'id' | 'completed'>) => {
    console.log('[Checklist] handleAddTask called with:', newTask);
    console.log('[Checklist] projectId:', projectId);
    
    if (!projectId) {
      console.log('[Checklist] No projectId, returning early');
      setCreateTaskError('No active project');
      return;
    }

    if (!user) {
      console.log('[Checklist] No authenticated user, returning early');
      setCreateTaskError('You must be logged in to create tasks');
      return;
    }

    setIsCreatingTask(true);
    setCreateTaskError(null);

    try {
      console.log('[Checklist] Starting Supabase insert...');
      
      // First, get the project's tenant_id
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('tenant_id')
        .eq('id', projectId)
        .single();

      if (projectError || !projectData) {
        console.error('[Checklist] Failed to get project tenant_id:', projectError);
        setCreateTaskError('Failed to get project information');
        return;
      }

      console.log('[Checklist] Project tenant_id:', projectData.tenant_id);
      
      // Insert task into Supabase with tenant_id and created_by
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          project_id: projectId,
          tenant_id: projectData.tenant_id,
          title: newTask.title,
          phase: newTask.phase,
          due_date: newTask.dueDate || null,
          completed: false,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('[Checklist] Supabase error:', error);
        throw error;
      }

      console.log('[Checklist] Supabase insert success:', data);

      if (data) {
        // Map the returned data to the frontend Task format
        const persistedTask = {
          id: data.id,
          title: data.title,
          phase: data.phase,
          dueDate: data.due_date,
          completed: data.completed,
          projectId: data.project_id,
        };

        console.log('[Checklist] Adding task to store:', persistedTask);
        // Add to store with the real persisted task (including DB-generated UUID)
        addTask(projectId, persistedTask);
        console.log('[Checklist] Task added to store successfully');
      }
    } catch (err: any) {
      console.error('[Checklist] Error in handleAddTask:', err);
      setCreateTaskError(err?.message || 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
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

  const handleUpdateTask = async (updatedTask: Omit<Task, 'id' | 'completed'>) => {
    if (!editingTask) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: updatedTask.title,
          phase: updatedTask.phase,
          due_date: updatedTask.dueDate || null,
        })
        .eq('id', editingTask.id);

      if (error) {
        console.error('Error updating task:', error);
        return;
      }

      updateTask(projectId, editingTask.id, updatedTask);
      setIsEditModalOpen(false);
      setEditingTask(null);
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    // Find the task to get current completed state
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newCompletedState = !task.completed;

    // Optimistically update UI
    toggleTaskCompletion(projectId, taskId);

    try {
      // Persist to backend
      const { error } = await supabase
        .from('tasks')
        .update({ completed: newCompletedState })
        .eq('id', taskId);

      if (error) {
        console.error('Error updating task completion:', error);
        // Revert UI on error
        toggleTaskCompletion(projectId, taskId);
      }
    } catch (err) {
      console.error('Failed to update task:', err);
      // Revert UI on error
      toggleTaskCompletion(projectId, taskId);
    }
  };

  const generateAISuggestions = async (phase: TaskPhaseDB, previouslySuggested: string[] = []) => {
    if (!projectId) {
      setAiError('Projeto não encontrado');
      return null;
    }

    setIsGenerating(true);
    setAiError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAiError('Sessão não encontrada. Por favor, faça login novamente.');
        return null;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-checklist-suggestions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            project_id: projectId,
            phase,
            previously_suggested: previouslySuggested,
          }),
        }
      );

      if (response.status === 429) {
        setAiError('Limite de sugestões atingido este mês. Faz upgrade para o plano Pro para sugestões ilimitadas.');
        // Refresh usage from backend to show accurate limit state
        loadAIUsage();
        return null;
      }

      if (response.status === 401) {
        setAiError('Não autorizado. Por favor, faça login novamente.');
        return null;
      }

      if (response.status === 404) {
        setAiError('Projeto não encontrado ou acesso negado.');
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro desconhecido');
        setAiError(`Erro ao gerar sugestões: ${errorText}`);
        return null;
      }

      const data = await response.json();
      
      if (!data.ok || !data.suggestions) {
        setAiError('Resposta inválida do servidor.');
        return null;
      }

      // Update usage from backend response, or re-read it if the backend could not report it
      const updatedUsage = parseAIUsage(data.usage);
      if (updatedUsage) {
        applyAIUsage(updatedUsage);
      } else {
        loadAIUsage();
      }

      // Map backend suggestions to frontend model
      const mappedSuggestions: AISuggestion[] = data.suggestions.map((s: any, index: number) => ({
        id: `ai_sugg_${Date.now()}_${index}`,
        title: s.title,
        phase,
        priority: s.priority,
        reason: s.reason,
      }));

      return mappedSuggestions;
    } catch (error) {
      console.error('[Checklist] Error generating AI suggestions:', error);
      setAiError('Erro de rede. Por favor, tente novamente.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (hasReachedLimit || isGenerating) return;
    
    const suggestions = await generateAISuggestions(selectedAiPhase);
    
    if (suggestions) {
      setAiSuggestions(suggestions);
      setHasGenerated(true);
      setSelectedSuggestions(new Set());
      setShowConfirmation(null);
    }
  };

  const handleSelectAll = () => {
    if (selectedSuggestions.size === aiSuggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(new Set(aiSuggestions.map(s => s.id)));
    }
  };

  const toggleSuggestion = (id: string) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
  });
  };

  const handleAddSelectedTasks = async () => {
    const tasksToAdd = aiSuggestions.filter(s => selectedSuggestions.has(s.id));
    
    if (tasksToAdd.length === 0) return;
    
    setIsAddingTasks(true);
    setTaskCreationError(null);
    
    const successfulIds: string[] = [];
    const failedIds: string[] = [];
    
    // Sequentially create each task
    for (const suggestion of tasksToAdd) {
      try {
        await handleAddTask({
          title: suggestion.title,
          phase: suggestion.phase,
          dueDate: undefined,
        });
        successfulIds.push(suggestion.id);
      } catch (error) {
        console.error('[Checklist] Failed to create task:', suggestion.title, error);
        failedIds.push(suggestion.id);
      }
    }
    
    // Remove only successfully created suggestions from the list
    if (successfulIds.length > 0) {
      setAiSuggestions(prev => prev.filter(s => !successfulIds.includes(s.id)));
    }
    
    // Keep failed suggestions selected for retry
    if (failedIds.length > 0) {
      setSelectedSuggestions(new Set(failedIds));
      setTaskCreationError(`${failedIds.length} tarefa(s) falhou/aram. Tenta novamente.`);
    } else {
      setSelectedSuggestions(new Set());
    }
    
    // Show appropriate message
    if (failedIds.length === 0) {
      setShowConfirmation(`✅ ${successfulIds.length} tarefa(s) adicionada(s)`);
    } else if (successfulIds.length === 0) {
      setShowConfirmation(`❌ Falha ao adicionar tarefas`);
    } else {
      setShowConfirmation(`⚠️ ${successfulIds.length} adicionada(s), ${failedIds.length} falhou/aram`);
    }
    
    setTimeout(() => setShowConfirmation(null), 5000);
    setIsAddingTasks(false);
  };

  const handleLoadMore = async () => {
    if (hasReachedLimit || isGenerating) return;
    
    // Get titles of already suggested tasks to avoid duplicates
    const previouslySuggested = aiSuggestions.map(s => s.title);
    
    const moreSuggestions = await generateAISuggestions(selectedAiPhase, previouslySuggested);
    
    if (moreSuggestions) {
      setAiSuggestions(prev => [...prev, ...moreSuggestions]);
    }
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

      {/* Error Display */}
      {createTaskError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {createTaskError}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Checklist</h1>
          <p className="text-gray-600 text-lg">
            {areTaskCountsKnown
              ? `${totalPendingTasks} tarefas pendentes`
              : tasksContentState === 'loading' ? 'A carregar tarefas...' : ' '}
          </p>
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
            {tab.label}{areTaskCountsKnown && ` (${tab.count})`}
          </button>
        ))}
      </div>

      {/* Refresh failed while tasks are already shown */}
      {hasTasks && tasksStatus === 'error' && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{tasksError || 'Não foi possível carregar as tarefas.'}</p>
          <Button variant="secondary" size="sm" onClick={handleRetryTasks}>
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {tasksContentState === 'loading' ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">A carregar tarefas...</p>
          </div>
        ) : tasksContentState === 'error' ? (
          <div className="text-center py-8">
            <p className="text-red-600 font-medium mb-1">{tasksError || 'Não foi possível carregar as tarefas.'}</p>
            <p className="text-sm text-gray-500 mb-4">Verifica a tua ligação e tenta novamente.</p>
            <Button variant="secondary" size="sm" onClick={handleRetryTasks}>
              Tentar novamente
            </Button>
          </div>
        ) : currentTasks.length > 0 ? (
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
          <EmptyState
            icon={<CheckSquare className="w-8 h-8" />}
            title="Sem tarefas no checklist"
            description="As tarefas do projeto irão aparecer aqui."
          />
        )}
      </div>

      {/* AI Suggestions Section */}
      <Card className="mt-6 overflow-hidden">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Sugestões com IA</h2>
            </div>
            <span className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full">
              Beta
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Sugestões de tarefas para esta fase com base no teu projeto
          </p>
        </div>

        {/* AI Usage Bar */}
        <div className="px-4 md:px-6 py-3 bg-purple-50/50 border-b border-gray-100">
          {aiUsage ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-700">
                  {`${aiUsage.used} de ${aiUsage.limit} sugestões IA usadas este mês`}
                </span>
                <span className="text-xs text-purple-600">
                  {aiUsage.remaining} restantes
                </span>
              </div>
              <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300 bg-purple-600"
                  style={{ width: `${aiUsage.limit > 0 ? Math.min(100, (aiUsage.used / aiUsage.limit) * 100) : 100}%` }}
                />
              </div>
            </>
          ) : aiUsageState.status === 'error' ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-700">
                  Utilização de IA indisponível de momento
                </span>
                <button
                  onClick={() => loadAIUsage()}
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
              <div className="h-2 bg-purple-100 rounded-full overflow-hidden" />
            </>
          ) : (
            <div aria-busy="true" aria-label="A carregar utilização de IA">
              <div className="flex items-center justify-between mb-2">
                <div className="h-5 w-56 max-w-[70%] bg-purple-100 rounded animate-pulse" />
                <div className="h-4 w-16 bg-purple-100 rounded animate-pulse" />
              </div>
              <div className="h-2 bg-purple-100 rounded-full overflow-hidden animate-pulse" />
            </div>
          )}
          
          {/* Upgrade CTA when limit reached */}
          {hasReachedLimit && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Crown className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-900 text-sm">
                    Limite de sugestões atingido
                  </h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Faz upgrade para o plano Pro para sugestões ilimitadas.
                  </p>
                  <button
                    onClick={() => router.push(`/${projectId}/profile?tab=plans`)}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Ver planos
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 md:p-6 border-b border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Fase</label>
              <select
                value={selectedAiPhase}
                onChange={(e) => setSelectedAiPhase(e.target.value as TaskPhaseDB)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-gray-900 bg-white"
              >
                {PHASES.map(p => (
                  <option key={p} value={p}>{PHASE_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="md:pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2 md:hidden">Ação</label>
              <button
                onClick={handleGenerateSuggestions}
                disabled={hasReachedLimit || isGenerating}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>A gerar...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Gerar sugestões</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="p-4 md:p-6">
          {/* Error Message */}
          {aiError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {aiError}
            </div>
          )}

          {/* Task Creation Error Message */}
          {taskCreationError && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              {taskCreationError}
            </div>
          )}

          {!hasGenerated ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wand2 className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-sm text-gray-500">
                Seleciona a fase e clica em "Gerar sugestões" para começar
              </p>
            </div>
          ) : (
            <>
              {/* Results Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-600">
                  {aiSuggestions.length} sugestões encontradas
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  {selectedSuggestions.size === aiSuggestions.length ? 'Desselecionar tudo' : 'Selecionar tudo'}
                </button>
              </div>

              {/* Confirmation Message */}
              {showConfirmation && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                  {showConfirmation}
                </div>
              )}

              {/* Suggestions List */}
              <div className="space-y-3 mb-6">
                {aiSuggestions.map((suggestion) => (
                  <label
                    key={suggestion.id}
                    className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSuggestions.has(suggestion.id)}
                      onChange={() => toggleSuggestion(suggestion.id)}
                      className="mt-0.5 w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 text-sm mb-1">
                        {suggestion.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-500">Fase: {suggestion.phase}</span>
                        <span className={`px-2 py-0.5 rounded-full font-medium ${
                          suggestion.priority === 'Alta' 
                            ? 'bg-red-100 text-red-700'
                            : suggestion.priority === 'Média'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          Prioridade: {suggestion.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 italic">
                        Motivo: {suggestion.reason}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleAddSelectedTasks}
                  disabled={selectedSuggestions.size === 0 || isAddingTasks}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isAddingTasks ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>A adicionar...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Adicionar tarefas selecionadas
                    </>
                  )}
                </button>
                <button
                  onClick={handleLoadMore}
                  disabled={hasReachedLimit || isGenerating}
                  className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-300/30 border-t-gray-600 rounded-full animate-spin" />
                      <span>A carregar...</span>
                    </>
                  ) : (
                    'Ver mais sugestões'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </Card>

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
