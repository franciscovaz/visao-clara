import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { mockProjects, Project } from '@/src/mocks';
import { mockTasks, Task } from '@/src/mocks';

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
    }),
    {
      name: 'ProjectStore', // Clear name for Redux DevTools
      enabled: process.env.NODE_ENV === 'development', // Only in development
    }
  )
);
