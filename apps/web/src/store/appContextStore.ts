import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface OnboardingData {
  projectType: string;
  projectDescription?: string;
  propertyType: string;
  propertyDescription?: string;
  currentPhase: string;
  goal: string;
  budget?: string;
}

interface AppContextState {
  activeTenantId: string | null;
  activeProjectId: string | null;
  pendingOnboardingData: OnboardingData | null;
  setActiveTenantId: (id: string | null) => void;
  setActiveProjectId: (id: string | null) => void;
  setPendingOnboardingData: (data: OnboardingData) => void;
  clearPendingOnboardingData: () => void;
  hasPendingOnboarding: () => boolean;
  resetAppContext: () => void;
}

export const useAppContextStore = create<AppContextState>()(
  devtools(
    (set, get) => ({
      activeTenantId: null,
      activeProjectId: null,
      pendingOnboardingData: null,
      setActiveTenantId: (id) => set({ activeTenantId: id }),
      setActiveProjectId: (id) => set({ activeProjectId: id }),
      setPendingOnboardingData: (data) => set({ pendingOnboardingData: data }),
      clearPendingOnboardingData: () => set({ pendingOnboardingData: null }),
      hasPendingOnboarding: () => !!get().pendingOnboardingData,
      resetAppContext: () => set({ 
        activeTenantId: null, 
        activeProjectId: null,
        pendingOnboardingData: null,
      }),
    }),
    {
      name: 'app-context-store',
    }
  )
);
