import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface OnboardingData {
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
  // When the pending data was saved; stale answers are discarded (see ProfileService)
  pendingOnboardingSavedAt: number | null;
  setActiveTenantId: (id: string | null) => void;
  setActiveProjectId: (id: string | null) => void;
  setPendingOnboardingData: (data: OnboardingData) => void;
  clearPendingOnboardingData: () => void;
  hasPendingOnboarding: () => boolean;
  resetAppContext: () => void;
}

export const useAppContextStore = create<AppContextState>()(
  devtools(
    persist(
      (set, get) => ({
        activeTenantId: null,
        activeProjectId: null,
        pendingOnboardingData: null,
        pendingOnboardingSavedAt: null,
        setActiveTenantId: (id) => set({ activeTenantId: id }),
        setActiveProjectId: (id) => set({ activeProjectId: id }),
        setPendingOnboardingData: (data) => set({ pendingOnboardingData: data, pendingOnboardingSavedAt: Date.now() }),
        clearPendingOnboardingData: () => set({ pendingOnboardingData: null, pendingOnboardingSavedAt: null }),
        hasPendingOnboarding: () => !!get().pendingOnboardingData,
        resetAppContext: () => set({
          activeTenantId: null,
          activeProjectId: null,
          pendingOnboardingData: null,
          pendingOnboardingSavedAt: null,
        }),
      }),
      {
        // Only the onboarding answers survive full-page redirects (Google OAuth,
        // email confirmation). No ids, tokens or session data are persisted.
        name: 'vc-pending-onboarding',
        partialize: (state) => ({
          pendingOnboardingData: state.pendingOnboardingData,
          pendingOnboardingSavedAt: state.pendingOnboardingSavedAt,
        }),
      }
    ),
    {
      name: 'app-context-store',
    }
  )
);
