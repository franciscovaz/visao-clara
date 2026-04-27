'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/src/store/authStore';
import { useProjectStore } from '@/src/store/projectStore';
import { ProfileService } from '@/src/services/profileService';
import { supabase } from '@/lib/supabase/client';

interface DataProviderProps {
  children: React.ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const { user, initialized: authInitialized } = useAuthStore();
  const { 
    setUserProfile, 
    setProjects, 
    projects,
    userProfile 
  } = useProjectStore();
  
  const profileLoadedRef = useRef(false);
  const projectsLoadedRef = useRef(false);

  // Load user profile once when auth is ready
  useEffect(() => {
    if (!authInitialized || !user) {
      profileLoadedRef.current = false;
      return;
    }

    if (profileLoadedRef.current) return;

    const loadProfile = async () => {
      try {
        const profile = await ProfileService.loadProfileAndSyncPlan();
        if (profile) {
          setUserProfile({
            id: user.id,
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            email: user.email || '',
            phone: profile.phone || '',
            city: profile.city || '',
            country: profile.country || '',
            avatarInitials: '',
            plan: (profile.plan as 'free' | 'pro' | 'premium') || 'free',
          });
        }
        profileLoadedRef.current = true;
      } catch (err) {
        console.error('Failed to load profile:', err);
      }
    };

    loadProfile();
  }, [authInitialized, user, setUserProfile]);

  // Load projects list once when auth is ready
  useEffect(() => {
    if (!authInitialized || !user) {
      projectsLoadedRef.current = false;
      return;
    }

    if (projectsLoadedRef.current || projects.length > 0) return;

    const loadProjects = async () => {
      try {
        const { data: tenantMembers } = await supabase
          .from('tenant_members')
          .select('tenant_id')
          .eq('user_id', user.id)
          .limit(1);

        if (!tenantMembers?.length) return;

        const tenantId = tenantMembers[0].tenant_id;
        const { data: projectsData } = await supabase
          .from('projects')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (projectsData) {
          const mappedProjects = projectsData.map(p => ({
            id: p.id,
            name: p.name,
            type: p.project_type === 'renovation' ? 'Renovação'
              : p.project_type === 'new_construction' ? 'Construção Nova'
              : p.project_type,
            phase: p.current_phase === 'design' ? 'Design'
              : p.current_phase === 'licenses' ? 'Licenças'
              : p.current_phase === 'construction' ? 'Construção'
              : p.current_phase === 'finishing' ? 'Acabamentos'
              : p.current_phase === 'completed' ? 'Concluído'
              : 'Planeamento',
            description: p.project_description || '',
            status: p.status,
            created_at: p.created_at,
            updated_at: p.updated_at,
            tenant_id: p.tenant_id,
            created_by: p.created_by,
            budget: p.budget || '',
            propertyType: p.property_type || '',
            mainGoal: p.goal || '',
            project_type: p.project_type,
            property_type: p.property_type,
            current_phase: p.current_phase,
            goal: p.goal,
          }));
          setProjects(mappedProjects);
          projectsLoadedRef.current = true;
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    };

    loadProjects();
  }, [authInitialized, user, projects.length, setProjects]);

  return <>{children}</>;
}
