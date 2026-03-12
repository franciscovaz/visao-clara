'use client';

import { useEffect } from 'react';
import { initializeAuth } from '@/src/store/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Supabase auth listener
    const cleanup = initializeAuth();

    return cleanup;
  }, []);

  return <>{children}</>;
}
