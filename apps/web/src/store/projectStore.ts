import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { mockProjects, Project } from '@/src/mocks';
import { Task, mockTasks } from '@/src/mocks/tasks';
import { Expense, mockExpenses } from '@/src/mocks/expenses';
import { Document, mockDocuments } from '@/src/mocks/documents';
import { Responsible, mockResponsibles } from '@/src/mocks';

// Phase order for fallback sorting
const PHASE_ORDER = ['Planejamento', 'Design', 'Licenças', 'Construção', 'Acabamentos', 'Concluído'];
const PHASE_ORDER_MAP = PHASE_ORDER.reduce((map, phase, index) => {
  map[phase] = index;
  return map;
}, {} as Record<string, number>);

type ProjectStore = {
  projects: Project[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  getActiveProject: () => Project | undefined;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  // Task management
  tasksByProjectId: Record<string, Task[]>;
  toggleTaskCompletion: (projectId: string, taskId: string) => void;
  getTasksForProject: (projectId: string) => Task[];
  addTask: (projectId: string, task: Omit<Task, 'id' | 'completed'>) => void;
  getNextSteps: (projectId: string, limit?: number) => Task[];
  // Expense management
  expensesByProjectId: Record<string, Expense[]>;
  getExpensesForProject: (projectId: string) => Expense[];
  addExpense: (projectId: string, expense: Omit<Expense, 'id'>) => void;
  updateExpense: (projectId: string, expenseId: string, updates: Partial<Expense>) => void;
  deleteExpense: (projectId: string, expenseId: string) => void;
  // Document management
  documentsByProjectId: Record<string, Document[]>;
  getDocumentsForProject: (projectId: string) => Document[];
  addDocument: (projectId: string, document: Omit<Document, 'id'>) => void;
  deleteDocument: (projectId: string, documentId: string) => void;
  // Responsible management
  responsiblesByProjectId: Record<string, Responsible[]>;
  addResponsible: (projectId: string, responsible: Omit<Responsible, 'id'>) => void;
  deleteResponsible: (projectId: string, responsibleId: string) => void;
  getResponsiblesForProject: (projectId: string) => Responsible[];
};

// Initialize tasks grouped by projectId from mockTasks
const initializeTasksByProjectId = (): Record<string, Task[]> => {
  const grouped: Record<string, Task[]> = {};
  mockTasks.forEach(task => {
    if (!grouped[task.projectId]) {
      grouped[task.projectId] = [];
    }
    grouped[task.projectId].push(task);
  });
  return grouped;
};

// Initialize expenses grouped by projectId from mockExpenses
const initializeExpensesByProjectId = (): Record<string, Expense[]> => {
  const grouped: Record<string, Expense[]> = {};
  mockExpenses.forEach(expense => {
    if (!grouped[expense.projectId]) {
      grouped[expense.projectId] = [];
    }
    grouped[expense.projectId].push(expense);
  });
  return grouped;
};

// Initialize documents grouped by projectId from mockDocuments
const initializeDocumentsByProjectId = (): Record<string, Document[]> => {
  const grouped: Record<string, Document[]> = {};
  mockDocuments.forEach(document => {
    if (!grouped[document.projectId]) {
      grouped[document.projectId] = [];
    }
    grouped[document.projectId].push(document);
  });
  return grouped;
};

// Initialize responsibles grouped by projectId from mockResponsibles
const initializeResponsiblesByProjectId = (): Record<string, Responsible[]> => {
  const grouped: Record<string, Responsible[]> = {};
  mockResponsibles.forEach(responsible => {
    if (!grouped[responsible.projectId]) {
      grouped[responsible.projectId] = [];
    }
    grouped[responsible.projectId].push(responsible);
  });
  return grouped;
};

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      projects: mockProjects,
      activeProjectId: mockProjects[0]?.id ?? '',
      setActiveProjectId: (id: string) => set({ activeProjectId: id }),
      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        return projects.find(p => p.id === activeProjectId);
      },
      updateProject: (projectId: string, updates: Partial<Project>) => {
        set((state) => ({
          projects: state.projects.map(project =>
            project.id === projectId
              ? { ...project, ...updates }
              : project
          )
        }));
      },
      // Task management
      tasksByProjectId: initializeTasksByProjectId(),
      toggleTaskCompletion: (projectId: string, taskId: string) => {
        set((state) => ({
          tasksByProjectId: {
            ...state.tasksByProjectId,
            [projectId]: state.tasksByProjectId[projectId]?.map(task =>
              task.id === taskId
                ? { ...task, completed: !task.completed }
                : task
            ) || []
          }
        }));
      },
      getTasksForProject: (projectId: string) => {
        const { tasksByProjectId } = get();
        return tasksByProjectId[projectId] || [];
      },
      addTask: (projectId: string, task: Omit<Task, 'id' | 'completed'>) => {
        const newTask: Task = {
          ...task,
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          completed: false,
        };
        
        set((state) => ({
          tasksByProjectId: {
            ...state.tasksByProjectId,
            [projectId]: [...(state.tasksByProjectId[projectId] || []), newTask]
          }
        }));
      },
      getNextSteps: (projectId: string, limit = 5) => {
        const { tasksByProjectId } = get();
        const tasks = tasksByProjectId[projectId] || [];
        
        // Filter only not completed tasks
        const incompleteTasks = tasks.filter(task => !task.completed);
        
        // Sort tasks with priority: due date first, then phase order
        const sortedTasks = [...incompleteTasks].sort((a, b) => {
          // Both tasks have due dates - sort by nearest due date first
          if (a.dueDate && b.dueDate) {
            const dateA = new Date(a.dueDate);
            const dateB = new Date(b.dueDate);
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
              return dateA.getTime() - dateB.getTime();
            }
          }
          
          // Task A has due date, B doesn't - A comes first
          if (a.dueDate && !b.dueDate) {
            const dateA = new Date(a.dueDate);
            if (!isNaN(dateA.getTime())) {
              return -1;
            }
          }
          
          // Task B has due date, A doesn't - B comes first
          if (!a.dueDate && b.dueDate) {
            const dateB = new Date(b.dueDate);
            if (!isNaN(dateB.getTime())) {
              return 1;
            }
          }
          
          // Both tasks have no due dates or invalid dates - sort by phase order
          const phaseOrderA = PHASE_ORDER_MAP[a.phase] ?? 999;
          const phaseOrderB = PHASE_ORDER_MAP[b.phase] ?? 999;
          
          if (phaseOrderA !== phaseOrderB) {
            return phaseOrderA - phaseOrderB;
          }
          
          // Same phase - sort by ID for deterministic order
          return a.id.localeCompare(b.id);
        });
        
        return sortedTasks.slice(0, limit);
      },
      // Expense management
      expensesByProjectId: initializeExpensesByProjectId(),
      getExpensesForProject: (projectId: string) => {
        const { expensesByProjectId } = get();
        return expensesByProjectId[projectId] || [];
      },
      addExpense: (projectId: string, expense: Omit<Expense, 'id'>) => {
        const newExpense: Expense = {
          ...expense,
          id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        
        set((state) => ({
          expensesByProjectId: {
            ...state.expensesByProjectId,
            [projectId]: [...(state.expensesByProjectId[projectId] || []), newExpense]
          }
        }));
      },
      updateExpense: (projectId: string, expenseId: string, updates: Partial<Expense>) => {
        set((state) => ({
          expensesByProjectId: {
            ...state.expensesByProjectId,
            [projectId]: state.expensesByProjectId[projectId]?.map(expense =>
              expense.id === expenseId
                ? { ...expense, ...updates }
                : expense
            ) || []
          }
        }));
      },
      deleteExpense: (projectId: string, expenseId: string) => {
        set((state) => ({
          expensesByProjectId: {
            ...state.expensesByProjectId,
            [projectId]: state.expensesByProjectId[projectId]?.filter(expense =>
              expense.id !== expenseId
            ) || []
          }
        }));
      },
      // Responsible management
      getResponsiblesForProject: (projectId: string) => {
        const { responsiblesByProjectId } = get();
        return responsiblesByProjectId[projectId] || [];
      },
      addResponsible: (projectId: string, responsible: Omit<Responsible, 'id'>) => {
        const newResponsible: Responsible = {
          ...responsible,
          id: `responsible_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        
        set((state) => ({
          responsiblesByProjectId: {
            ...state.responsiblesByProjectId,
            [projectId]: [...(state.responsiblesByProjectId[projectId] || []), newResponsible]
          }
        }));
      },
      deleteResponsible: (projectId: string, responsibleId: string) => {
        set((state) => ({
          responsiblesByProjectId: {
            ...state.responsiblesByProjectId,
            [projectId]: state.responsiblesByProjectId[projectId]?.filter(responsible =>
              responsible.id !== responsibleId
            ) || []
          }
        }));
      },
      documentsByProjectId: initializeDocumentsByProjectId(),
      responsiblesByProjectId: initializeResponsiblesByProjectId(),
      getDocumentsForProject: (projectId: string) => {
        const { documentsByProjectId } = get();
        return documentsByProjectId[projectId] || [];
      },
      addDocument: (projectId: string, document: Omit<Document, 'id'>) => {
        const newDocument: Document = {
          ...document,
          id: `document_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        
        set((state) => ({
          documentsByProjectId: {
            ...state.documentsByProjectId,
            [projectId]: [...(state.documentsByProjectId[projectId] || []), newDocument]
          }
        }));
      },
      deleteDocument: (projectId: string, documentId: string) => {
        set((state) => ({
          documentsByProjectId: {
            ...state.documentsByProjectId,
            [projectId]: state.documentsByProjectId[projectId]?.filter(document =>
              document.id !== documentId
            ) || []
          }
        }));
      },
    }),
    {
      name: 'ProjectStore', // Clear name for Redux DevTools
      enabled: process.env.NODE_ENV === 'development', // Only in development
    }
  )
);
