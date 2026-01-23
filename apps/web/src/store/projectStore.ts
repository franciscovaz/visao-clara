import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { mockProjects } from '@/src/mocks';

type Project = {
  id: string;
  name: string;
};

type ProjectStore = {
  projects: Project[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
};

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set) => ({
      projects: mockProjects,
      activeProjectId: mockProjects[0]?.id ?? '',
      setActiveProjectId: (id: string) => set({ activeProjectId: id }),
    }),
    {
      name: 'ProjectStore', // Clear name for Redux DevTools
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);
