import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { mockProjects, Project } from '@/src/mocks';
import { mockTasks, Task } from '@/src/mocks';

// Phase order for fallback sorting
const PHASE_ORDER = ['Planejamento', 'Design', 'Licenças', 'Construção', 'Acabamentos', 'Concluído'];
const PHASE_ORDER_MAP = PHASE_ORDER.reduce((map, phase, index) => {
  map[phase] = index;
  return map;
}, {} as Record<string, number>);

type ProjectStore = {
  projects: Project[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  getActiveProject: () => Project | undefined;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  // Task management
  tasksByProjectId: Record<string, Task[]>;
  toggleTaskCompletion: (projectId: string, taskId: string) => void;
  getTasksForProject: (projectId: string) => Task[];
  addTask: (projectId: string, task: Omit<Task, 'id' | 'completed'>) => void;
  getNextSteps: (projectId: string, limit?: number) => Task[];
};

// Initialize tasks grouped by projectId from mockTasks
const initializeTasksByProjectId = (): Record<string, Task[]> => {
  const grouped: Record<string, Task[]> = {};
  mockTasks.forEach(task => {
    if (!grouped[task.projectId]) {
      grouped[task.projectId] = [];
    }
    grouped[task.projectId].push(task);
  });
  return grouped;
};

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      projects: mockProjects,
      activeProjectId: mockProjects[0]?.id ?? '',
      setActiveProjectId: (id: string) => set({ activeProjectId: id }),
      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        return projects.find(p => p.id === activeProjectId);
      },
      updateProject: (projectId: string, updates: Partial<Project>) => {
        set((state) => ({
          projects: state.projects.map(project =>
            project.id === projectId
              ? { ...project, ...updates }
              : project
          )
        }));
      },
      // Task management
      tasksByProjectId: initializeTasksByProjectId(),
      toggleTaskCompletion: (projectId: string, taskId: string) => {
        set((state) => ({
          tasksByProjectId: {
            ...state.tasksByProjectId,
            [projectId]: state.tasksByProjectId[projectId]?.map(task =>
              task.id === taskId
                ? { ...task, completed: !task.completed }
                : task
            ) || []
          }
        }));
      },
      getTasksForProject: (projectId: string) => {
        const { tasksByProjectId } = get();
        return tasksByProjectId[projectId] || [];
      },
      addTask: (projectId: string, task: Omit<Task, 'id' | 'completed'>) => {
        const newTask: Task = {
          ...task,
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          completed: false,
        };
        
        set((state) => ({
          tasksByProjectId: {
            ...state.tasksByProjectId,
            [projectId]: [...(state.tasksByProjectId[projectId] || []), newTask]
          }
        }));
      },
      getNextSteps: (projectId: string, limit = 5) => {
        const { tasksByProjectId } = get();
        const tasks = tasksByProjectId[projectId] || [];
        
        // Filter only not completed tasks
        const incompleteTasks = tasks.filter(task => !task.completed);
        
        // Sort tasks with priority: due date first, then phase order
        const sortedTasks = [...incompleteTasks].sort((a, b) => {
          // Both tasks have due dates - sort by nearest due date first
          if (a.dueDate && b.dueDate) {
            const dateA = new Date(a.dueDate);
            const dateB = new Date(b.dueDate);
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
              return dateA.getTime() - dateB.getTime();
            }
          }
          
          // Task A has due date, B doesn't - A comes first
          if (a.dueDate && !b.dueDate) {
            const dateA = new Date(a.dueDate);
            if (!isNaN(dateA.getTime())) {
              return -1;
            }
          }
          
          // Task B has due date, A doesn't - B comes first
          if (!a.dueDate && b.dueDate) {
            const dateB = new Date(b.dueDate);
            if (!isNaN(dateB.getTime())) {
              return 1;
            }
          }
          
          // Both tasks have no due dates or invalid dates - sort by phase order
          const phaseOrderA = PHASE_ORDER_MAP[a.phase] ?? 999;
          const phaseOrderB = PHASE_ORDER_MAP[b.phase] ?? 999;
          
          if (phaseOrderA !== phaseOrderB) {
            return phaseOrderA - phaseOrderB;
          }
          
          // Same phase - sort by ID for deterministic order
          return a.id.localeCompare(b.id);
        });
        
        return sortedTasks.slice(0, limit);
      },
    }),
    {
      name: 'ProjectStore', // Clear name for Redux DevTools
      enabled: process.env.NODE_ENV === 'development', // Only in development
    }
  )
);
