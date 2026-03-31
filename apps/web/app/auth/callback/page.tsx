'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { useAppContextStore } from '@/src/store/appContextStore';
import { ProfileService } from '@/src/services/profileService';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing authentication...');
  const { hasPendingOnboarding, pendingOnboardingData, clearPendingOnboardingData } = useAppContextStore();

  useEffect(() => {
    console.log('🔍 Auth callback page loaded');
    console.log('🔍 Current URL:', window.location.href);
    console.log('🔍 Current origin:', window.location.origin);
    console.log('🔍 Current pathname:', window.location.pathname);
    console.log('🔍 Search params:', Object.fromEntries(searchParams.entries()));

    const handleAuthCallback = async () => {
      try {
        console.log('🔍 Attempting to get session after OAuth redirect...');
        
        // Get the session after OAuth redirect
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('🔍 Session after OAuth redirect:', { session, error });
        console.log('🔍 Session user:', session?.user);
        console.log('🔍 Session email:', session?.user?.email);
        
        if (error) {
          console.error('❌ Error getting session after OAuth:', error);
          setStatus('Authentication failed. Please try again.');
          console.log('🔄 Redirecting to login in 3 seconds...');
          setTimeout(() => router.replace('/login'), 3000);
          return;
        }

        if (session) {
          console.log('✅ Successfully authenticated with Google OAuth');
          console.log('🔍 User:', session.user);
          setStatus('Authentication successful! Checking onboarding data...');
          
          // Check if user has pending onboarding data
          if (hasPendingOnboarding()) {
            // New user flow: onboarding completed before auth
            console.log('🎉 New user detected with onboarding data:', pendingOnboardingData);
            
            try {
              // Complete onboarding: create profile + tenant + project
              await ProfileService.completeOnboarding(pendingOnboardingData!);
              console.log('✅ Complete onboarding flow finished');
              
              // Clear temporary onboarding state only after successful completion
              clearPendingOnboardingData();
              setStatus('Conta configurada com sucesso! A redirecionar...');
            } catch (profileError) {
              console.error('❌ Failed to complete onboarding:', profileError);
              setStatus('Authentication successful, but failed to setup account. Redirecting...');
              // Still redirect even if onboarding failed
            }
          } else {
            setStatus('Authentication successful! Redirecting...');
          }
          
          console.log('🔄 Redirecting to dashboard in 1 second...');
          
          // Redirect to dashboard after successful auth
          setTimeout(() => router.replace('/proj_1/dashboard'), 1000);
        } else {
          console.log('❌ No session found after OAuth redirect');
          setStatus('Authentication failed. Please try again.');
          console.log('🔄 Redirecting to login in 3 seconds...');
          setTimeout(() => router.replace('/login'), 3000);
        }
      } catch (error) {
        console.error('❌ Auth callback error:', error);
        setStatus('An error occurred. Please try again.');
        console.log('🔄 Redirecting to login in 3 seconds...');
        setTimeout(() => router.replace('/login'), 3000);
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4 py-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">{status}</h1>
        <p className="text-sm text-slate-600">Please wait while we complete your authentication...</p>
      </div>
    </div>
  );
}
