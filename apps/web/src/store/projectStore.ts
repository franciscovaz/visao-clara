import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { mockProjects, Project } from '@/src/mocks';

type ProjectStore = {
  projects: Project[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  getActiveProject: () => Project | undefined;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
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
    }),
    {
      name: 'ProjectStore', // Clear name for Redux DevTools
      enabled: process.env.NODE_ENV === 'development', // Only in development
    }
  )
);
