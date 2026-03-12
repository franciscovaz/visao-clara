import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { supabase } from '../../lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        session: null,
        loading: false,
        initialized: false,

        signIn: async (email: string, password: string) => {
          set({ loading: true });
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (error) throw error;

            set({
              user: data.user,
              session: data.session,
              loading: false,
            });
          } catch (error) {
            set({ loading: false });
            throw error;
          }
        },

        signUp: async (email: string, password: string) => {
          set({ loading: true });
          try {
            const { data, error } = await supabase.auth.signUp({
              email,
              password,
            });

            if (error) throw error;

            set({
              user: data.user,
              session: data.session,
              loading: false,
            });
          } catch (error) {
            set({ loading: false });
            throw error;
          }
        },

        signOut: async () => {
          set({ loading: true });
          try {
            await supabase.auth.signOut();
            set({
              user: null,
              session: null,
              loading: false,
            });
          } catch (error) {
            set({ loading: false });
            throw error;
          }
        },

        resetAuth: () => {
          set({
            user: null,
            session: null,
            loading: false,
            initialized: false,
          });
        },
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          user: state.user,
          session: state.session,
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);

// Initialize auth state and listen for changes
let authListenerInitialized = false;

export const initializeAuth = () => {
  if (authListenerInitialized) return;

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event: string, session: Session | null) => {
      const store = useAuthStore.getState();
      
      // Update store with new auth state
      useAuthStore.setState({
        user: session?.user ?? null,
        session: session ?? null,
        loading: false,
        initialized: true,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 Auth state changed:', { event, session: !!session });
      }
    }
  );

  authListenerInitialized = true;

  return () => {
    subscription.unsubscribe();
    authListenerInitialized = false;
  };
};
