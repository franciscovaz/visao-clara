import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface AppContextState {
  activeTenantId: string | null;
  activeProjectId: string | null;
  setActiveTenantId: (id: string | null) => void;
  setActiveProjectId: (id: string | null) => void;
  resetAppContext: () => void;
}

export const useAppContextStore = create<AppContextState>()(
  devtools(
    (set) => ({
      activeTenantId: null,
      activeProjectId: null,
      setActiveTenantId: (id) => set({ activeTenantId: id }),
      setActiveProjectId: (id) => set({ activeProjectId: id }),
      resetAppContext: () => set({ activeTenantId: null, activeProjectId: null }),
    }),
    {
      name: 'app-context-store',
    }
  )
);
