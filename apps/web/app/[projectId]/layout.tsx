'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/src/store/projectStore';
import { supabase } from '@/lib/supabase/client';

// This layout ensures the current project is set consistently across all project pages
// It runs for every route under /[projectId]/ and syncs the route projectId to the store
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params.projectId as string;
  const { activeProjectId, setActiveProjectId, addProject, projects } = useProjectStore();

  // Sync route projectId to store - ensures selected project is correct after refresh
  useEffect(() => {
    if (projectId && projectId !== activeProjectId) {
      setActiveProjectId(projectId);
    }
  }, [projectId, activeProjectId, setActiveProjectId]);

  // Fetch and hydrate project data on refresh (if not already in store)
  useEffect(() => {
    const hydrateProject = async () => {
      if (!projectId) return;

      // Check if project is already in store
      const projectExists = projects.some(p => p.id === projectId);
      if (projectExists) return;

      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (error || !data) {
          console.error('Failed to fetch project:', error);
          return;
        }

        // Map backend data to frontend format
        const projectForStore = {
          id: data.id,
          name: data.name,
          type: data.project_type === 'renovation' ? 'Renovação'
            : data.project_type === 'new_construction' ? 'Construção Nova'
            : data.project_type,
          phase: data.current_phase === 'design' ? 'Design'
            : data.current_phase === 'licenses' ? 'Licenças'
            : data.current_phase === 'construction' ? 'Construção'
            : data.current_phase === 'finishing' ? 'Acabamentos'
            : data.current_phase === 'completed' ? 'Concluído'
            : 'Planeamento',
          description: data.project_description || '',
          status: data.status,
          created_at: data.created_at,
          updated_at: data.updated_at,
          tenant_id: data.tenant_id,
          created_by: data.created_by,
          budget: data.budget || '',
          propertyType: data.property_type || '',
          mainGoal: data.goal || '',
          project_type: data.project_type,
          property_type: data.property_type,
          current_phase: data.current_phase,
          goal: data.goal,
        };

        addProject(projectForStore as any);
      } catch (err) {
        console.error('Error hydrating project:', err);
      }
    };

    hydrateProject();
  }, [projectId, projects, addProject]);

  return <>{children}</>;
}
