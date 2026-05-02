'use client';

import { useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useProjectStore } from '@/src/store/projectStore';
import { supabase } from '@/lib/supabase/client';

// Track loaded projects to avoid refetching when navigating between routes
const loadedProjects = new Set<string>();

// This layout ensures the current project is set consistently across all project pages
// It runs for every route under /[projectId]/ and syncs the route projectId to the store
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const projectId = params.projectId as string;
  const { 
    activeProjectId, 
    setActiveProjectId, 
    addProject, 
    projects,
    setTasksForProject,
    setExpensesForProject,
    setResponsiblesForProject,
    setDocumentsForProject,
    getTasksForProject,
    getExpensesForProject,
    getResponsiblesForProject,
    getDocumentsForProject,
  } = useProjectStore();
  
  const lastProjectIdRef = useRef<string | null>(null);

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

  // Load project-specific data (tasks, expenses, responsibles, documents)
  // Only fetches if not already loaded for this project
  useEffect(() => {
    const loadProjectData = async () => {
      if (!projectId) return;
      
      // Reset loaded tracking when project changes
      if (lastProjectIdRef.current !== projectId) {
        lastProjectIdRef.current = projectId;
      }
      
      // Check if data already exists for this project
      const hasTasks = getTasksForProject(projectId).length > 0;
      const hasExpenses = getExpensesForProject(projectId).length > 0;
      const hasResponsibles = getResponsiblesForProject(projectId).length > 0;
      const hasDocuments = getDocumentsForProject(projectId).length > 0;
      
      // Skip if all data already loaded for this project
      if (hasTasks && hasExpenses && hasResponsibles && hasDocuments) {
        return;
      }

      try {
        // Load tasks if not present
        if (!hasTasks) {
          const { data: tasksData } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
          
          if (tasksData) {
            const mappedTasks = tasksData.map(task => ({
              id: task.id,
              title: task.title,
              phase: task.phase,
              dueDate: task.due_date,
              completed: task.completed,
              projectId: task.project_id,
            }));
            setTasksForProject(projectId, mappedTasks);
          }
        }

        // Load expenses if not present
        if (!hasExpenses) {
          const { data: expensesData } = await supabase
            .from('expenses')
            .select('*')
            .eq('project_id', projectId)
            .order('expense_date', { ascending: false });
          
          if (expensesData) {
            const mappedExpenses = expensesData.map(expense => ({
              id: expense.id,
              description: expense.description || expense.title,
              amount: expense.amount_cents / 100,
              date: expense.expense_date,
              category: expense.category,
              supplier: expense.supplier_name,
              warrantyExpiresAt: expense.warranty_expires_at,
              projectId: expense.project_id,
            }));
            setExpensesForProject(projectId, mappedExpenses);
          }
        }

        // Load responsibles if not present
        if (!hasResponsibles) {
          const { data: responsiblesData } = await supabase
            .from('responsibles')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
          
          if (responsiblesData) {
            const mappedResponsibles = responsiblesData.map(r => ({
              id: r.id,
              name: r.name,
              company: r.company || '',
              role: r.role,
              email: r.email || '',
              phone: r.phone || '',
              city: r.city || '',
              projectId: r.project_id,
            }));
            setResponsiblesForProject(projectId, mappedResponsibles);
          }
        }

        // Load documents if not present
        if (!hasDocuments) {
          const { data: documentsData } = await supabase
            .from('documents')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
          
          if (documentsData) {
            const mappedDocuments = documentsData.map(doc => ({
              id: doc.id,
              name: doc.title,
              date: doc.issued_on
                ? new Date(doc.issued_on).toLocaleDateString('pt-PT')
                : new Date(doc.created_at).toLocaleDateString('pt-PT'),
              type: doc.doc_type,
              phase: doc.category || '',
              projectId: doc.project_id,
            }));
            setDocumentsForProject(projectId, mappedDocuments);
          }
        }
        
        loadedProjects.add(projectId);
      } catch (err) {
        console.error('Error loading project data:', err);
      }
    };

    loadProjectData();
  }, [projectId, setTasksForProject, setExpensesForProject, setResponsiblesForProject, setDocumentsForProject, getTasksForProject, getExpensesForProject, getResponsiblesForProject, getDocumentsForProject]);

  return <>{children}</>;
}
