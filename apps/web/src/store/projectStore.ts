import { create } from 'zustand';
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

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: mockProjects,
  activeProjectId: mockProjects[0]?.id ?? '',
  setActiveProjectId: (id: string) => set({ activeProjectId: id }),
}));
