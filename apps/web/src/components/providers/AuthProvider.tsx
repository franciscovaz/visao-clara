'use client';

import { useEffect } from 'react';
import { initializeAuth } from '@/src/store/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Supabase auth with session hydration
    initializeAuth().then((cleanup) => {
      console.log('✅ AuthProvider initialized successfully');
      return cleanup;
    }).catch((error) => {
      console.error('❌ Failed to initialize auth:', error);
    });
  }, []);

  return <>{children}</>;
}
