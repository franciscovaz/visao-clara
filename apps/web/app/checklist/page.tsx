'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Calendar, Trash2, Plus, Pencil, CheckSquare, Sparkles, Wand2, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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

// Display only: date-only ISO values (YYYY-MM-DD) as pt-PT dates, built in local time so the day never shifts
const formatDueDate = (value: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('pt-PT');
};

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

  const phaseTabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = phaseTabsRef.current;
    const tab = container?.querySelector<HTMLElement>(`[data-phase="${activeTab}"]`);
    if (!container || !tab || container.scrollWidth <= container.clientWidth) return;
    const start = tab.offsetLeft - 4;
    const end = tab.offsetLeft + tab.offsetWidth + 4;
    if (start < container.scrollLeft) {
      container.scrollTo({ left: start, behavior: 'smooth' });
    } else if (end > container.scrollLeft + container.clientWidth) {
      container.scrollTo({ left: end - container.clientWidth, behavior: 'smooth' });
    }
  }, [activeTab]);

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
      setTaskCreationError(`${failedIds.length === 1 ? '1 tarefa não foi adicionada' : `${failedIds.length} tarefas não foram adicionadas`}. Tenta novamente.`);
    } else {
      setSelectedSuggestions(new Set());
    }
    
    // Show appropriate message
    if (failedIds.length === 0) {
      setShowConfirmation(`✅ ${successfulIds.length} ${successfulIds.length === 1 ? 'tarefa adicionada' : 'tarefas adicionadas'}`);
    } else if (successfulIds.length === 0) {
      setShowConfirmation(`❌ Falha ao adicionar tarefas`);
    } else {
      setShowConfirmation(`⚠️ ${successfulIds.length} ${successfulIds.length === 1 ? 'adicionada' : 'adicionadas'}, ${failedIds.length} ${failedIds.length === 1 ? 'falhou' : 'falharam'}`);
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

      <div className="space-y-6">
      {/* Error Display */}
      {createTaskError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {createTaskError}
        </div>
      )}

      {/* Header (Figma: title + pending count, "Mostrar concluídas" switch, primary action) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checklist</h1>
          <p className="mt-1 text-sm text-gray-500">
            {areTaskCountsKnown
              ? `${totalPendingTasks} tarefas pendentes`
              : tasksContentState === 'loading' ? 'A carregar tarefas...' : ' '}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* Native checkbox styled as a switch: keeps keyboard and screen-reader behaviour */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              role="switch"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full bg-gray-300 transition-colors after:absolute after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2"
            />
            <span className="text-sm text-gray-700">Mostrar concluídas</span>
          </label>
          <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Phase tabs (Figma: muted segmented control, white active tab) */}
      <div
        ref={phaseTabsRef}
        role="group"
        aria-label="Fases"
        className="relative flex gap-1 overflow-x-auto overscroll-x-contain rounded-xl bg-muted p-1 md:flex-wrap md:overflow-visible"
      >
        {phaseTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            data-phase={tab.id}
            className={`flex-shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium md:min-w-[120px] md:flex-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}{areTaskCountsKnown && ` (${tab.count})`}
          </button>
        ))}
      </div>

      {/* Refresh failed while tasks are already shown */}
      {hasTasks && tasksStatus === 'error' && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{tasksError || 'Não foi possível carregar as tarefas.'}</p>
          <Button variant="secondary" size="sm" onClick={handleRetryTasks}>
            Tentar novamente
          </Button>
        </div>
      )}

      <Card className="p-4 md:p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900">{PHASE_LABELS[activeTab]}</h2>
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
          <ul className="space-y-3">
            {currentTasks.map((task) => (
              <li
                key={task.id}
                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors md:p-4 ${
                  task.completed ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <input
                  id={`task-${task.id}`}
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => handleToggleTask(task.id)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 cursor-pointer rounded text-blue-600 focus:ring-blue-500"
                />
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`task-${task.id}`}
                    className={`block cursor-pointer break-words text-sm font-medium ${
                      task.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                    }`}
                  >
                    {task.title}
                  </label>
                  {task.dueDate && (
                    <p className="mt-1 flex items-center text-xs text-gray-500">
                      <Calendar className="mr-1 h-3 w-3 flex-shrink-0" aria-hidden="true" />
                      Prazo: {formatDueDate(task.dueDate)}
                    </p>
                  )}
                </div>
                {/* Stacked on mobile so the title gets more width; 36px touch targets */}
                <div className="-my-1 flex flex-shrink-0 flex-col sm:flex-row sm:items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditTask(task)}
                    aria-label={`Editar tarefa: ${task.title}`}
                    title="Editar tarefa"
                    className="text-gray-500 hover:text-gray-900"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteTask(task.id)}
                    aria-label={`Eliminar tarefa: ${task.title}`}
                    title="Eliminar tarefa"
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<CheckSquare className="w-8 h-8" />}
            title="Sem tarefas nesta fase"
            description={
              !showCompleted && tasks.some(task => task.phase === activeTab && task.completed)
                ? 'Ative "Mostrar concluídas" para ver as tarefas concluídas.'
                : 'As tarefas desta fase irão aparecer aqui.'
            }
          />
        )}
      </Card>

      {/* AI Suggestions Section (Figma: AISuggestions card) */}
      <Card className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Sugestões com IA</h2>
              <p className="mt-1 text-sm text-gray-500">
                Sugestões de tarefas para esta fase com base no teu projeto
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="flex-shrink-0">Beta</Badge>
        </div>

        {/* AI usage (backend-owned values only) */}
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          {aiUsage ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-purple-900">
                    {`${aiUsage.used} de ${aiUsage.limit} sugestões IA usadas este mês`}
                  </span>
                  {hasReachedLimit ? (
                    <Badge variant="destructive">Limite atingido</Badge>
                  ) : (
                    <span className="text-xs text-purple-700">{aiUsage.remaining} restantes</span>
                  )}
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-purple-200/60"
                  role="progressbar"
                  aria-label="Sugestões IA usadas este mês"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(aiUsage.limit > 0 ? Math.min(100, (aiUsage.used / aiUsage.limit) * 100) : 100)}
                >
                  <div
                    className="h-full rounded-full bg-purple-600 transition-all duration-300"
                    style={{ width: `${aiUsage.limit > 0 ? Math.min(100, (aiUsage.used / aiUsage.limit) * 100) : 100}%` }}
                  />
                </div>
              </div>
              {hasReachedLimit && (
                <Button size="sm" onClick={() => router.push(`/${projectId}/profile?tab=plans`)} className="flex-shrink-0">
                  Ver planos
                </Button>
              )}
            </div>
          ) : aiUsageState.status === 'error' ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-purple-900">Utilização de IA indisponível de momento</span>
              <Button variant="ghost" size="sm" onClick={() => loadAIUsage()} className="h-8 px-3 text-purple-700 hover:bg-purple-100 hover:text-purple-800">
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div aria-busy="true" aria-label="A carregar utilização de IA">
              <div className="mb-2 h-5 w-56 max-w-[70%] animate-pulse rounded bg-purple-100" />
              <div className="h-2 animate-pulse rounded-full bg-purple-100" />
            </div>
          )}
        </div>

        {/* Limit reached */}
        {hasReachedLimit && (
          <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" aria-hidden="true" />
            <p className="text-sm text-orange-800">
              Limite mensal de sugestões atingido. Faz upgrade para o plano Pro para sugestões ilimitadas.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="ai-phase" className="block text-sm font-medium text-gray-900">Fase</label>
            <select
              id="ai-phase"
              value={selectedAiPhase}
              onChange={(e) => setSelectedAiPhase(e.target.value as TaskPhaseDB)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {PHASES.map(p => (
                <option key={p} value={p}>{PHASE_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <span aria-hidden="true" className="hidden text-sm font-medium text-gray-900 md:block">Ação</span>
            <Button
              size="sm"
              onClick={handleGenerateSuggestions}
              disabled={hasReachedLimit}
              loading={isGenerating}
              className="h-10 w-full gap-2"
            >
              {!isGenerating && <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {isGenerating ? 'A gerar...' : 'Gerar sugestões'}
            </Button>
          </div>
        </div>

        {/* Messages */}
        {/* While the usage-limit alert is shown it already explains a 429; other errors still show */}
        {aiError && !hasReachedLimit && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>{aiError}</p>
          </div>
        )}
        {taskCreationError && (
          <div role="alert" className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>{taskCreationError}</p>
          </div>
        )}
        {showConfirmation && (() => {
          // The handler prefixes the outcome with an emoji; show it as an icon and tone instead
          const tone = showConfirmation.startsWith('✅') ? 'success' : showConfirmation.startsWith('❌') ? 'error' : 'warning';
          const text = showConfirmation.replace(/^(✅|❌|⚠️?)\s*/u, '');
          return (
            <div
              role="status"
              className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
                tone === 'success' ? 'border-green-200 bg-green-50 text-green-800'
                : tone === 'error' ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {tone === 'success'
                ? <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
                : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />}
              <p>{text}</p>
            </div>
          );
        })()}

        {/* Results */}
        {!hasGenerated ? (
          isGenerating ? (
            <div aria-busy="true" className="space-y-3">
              <p className="text-sm text-gray-500">A gerar sugestões...</p>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-gray-200 p-4">
                  <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <Wand2 className="h-6 w-6 text-purple-600" aria-hidden="true" />
              </div>
              <p className="text-sm text-gray-500">
                Seleciona a fase e clica em &quot;Gerar sugestões&quot; para começar
              </p>
            </div>
          )
        ) : aiSuggestions.length === 0 ? (
          <div className="py-8 text-center">
            <Sparkles className="mx-auto mb-4 h-8 w-8 text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">
              Não há mais sugestões para mostrar. Experimenta outra fase ou gera novas sugestões.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Results header */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500">
                {aiSuggestions.length} {aiSuggestions.length === 1 ? 'sugestão encontrada' : 'sugestões encontradas'}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSelectAll} className="-mr-2 h-8 px-3">
                {selectedSuggestions.size === aiSuggestions.length ? 'Desselecionar tudo' : 'Selecionar tudo'}
              </Button>
            </div>

            {/* Suggestions list */}
            <ul className="space-y-2">
              {aiSuggestions.map((suggestion) => {
                const isSelected = selectedSuggestions.has(suggestion.id);
                return (
                  <li key={suggestion.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors md:p-4 ${
                        isSelected ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSuggestion(suggestion.id)}
                        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-medium text-gray-900">{suggestion.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span>Fase: {PHASE_LABELS[suggestion.phase] ?? suggestion.phase}</span>
                          <span aria-hidden="true">•</span>
                          <span className={`rounded-full border px-2 py-0.5 ${
                            suggestion.priority === 'Alta'
                              ? 'border-red-200 bg-red-50 text-red-600'
                              : suggestion.priority === 'Média'
                              ? 'border-orange-200 bg-orange-50 text-orange-600'
                              : 'border-blue-200 bg-blue-50 text-blue-600'
                          }`}>
                            Prioridade: {suggestion.priority}
                          </span>
                        </div>
                        <p className="mt-2 break-words text-xs italic text-gray-500">Motivo: {suggestion.reason}</p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>

            {/* Actions */}
            <div className="flex flex-col gap-2 border-t border-gray-200 pt-4 sm:flex-row">
              <Button
                size="sm"
                onClick={handleAddSelectedTasks}
                disabled={selectedSuggestions.size === 0}
                loading={isAddingTasks}
                className="h-10 flex-1 gap-2"
              >
                {isAddingTasks ? 'A adicionar...' : (
                  <>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {selectedSuggestions.size > 0
                      ? `Adicionar ${selectedSuggestions.size} ${selectedSuggestions.size === 1 ? 'tarefa selecionada' : 'tarefas selecionadas'}`
                      : 'Adicionar tarefas selecionadas'}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={hasReachedLimit}
                loading={isGenerating}
                className="h-10"
              >
                {isGenerating ? 'A carregar...' : 'Ver mais sugestões'}
              </Button>
            </div>
          </div>
        )}
      </Card>
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
