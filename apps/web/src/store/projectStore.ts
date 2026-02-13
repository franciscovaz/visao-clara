import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { mockProjects, Project } from '@/src/mocks';
import { Task, mockTasks } from '@/src/mocks/tasks';
import { Expense, mockExpenses } from '@/src/mocks/expenses';
import { Document, mockDocuments } from '@/src/mocks/documents';
import { Responsible, mockResponsibles } from '@/src/mocks';
import { UserProfile, mockUserProfile, PlanId } from '@/src/mocks/userProfile';
import { ExpenseCategory, mockExpenseCategories, generateDefaultExpenseCategories } from '@/src/mocks/expenseCategories';

// Entitlements types
export type Plan = PlanId;

export interface Entitlements {
  plan: Plan;
  limits: {
    activeProjects: number | 'unlimited';
    documentsPerProject: number | 'unlimited';
    aiCreditsMonthly: number | 'unlimited';
  };
  features: {
    exportEnabled: boolean;
    advancedExpenses: boolean;
    advancedAI: boolean;
    projectComparison: boolean;
    riskDetection: boolean;
    autoSummaries: boolean;
    prioritySupport: boolean;
  };
}

const deriveEntitlements = (planId: Plan): Entitlements => {
  switch (planId) {
    case 'free':
      return {
        plan: planId,
        limits: {
          activeProjects: 1,
          documentsPerProject: 10,
          aiCreditsMonthly: 2,
        },
        features: {
          exportEnabled: false,
          advancedExpenses: false,
          advancedAI: false,
          projectComparison: false,
          riskDetection: false,
          autoSummaries: false,
          prioritySupport: false,
        },
      };
    case 'pro':
      return {
        plan: planId,
        limits: {
          activeProjects: 'unlimited',
          documentsPerProject: 'unlimited',
          aiCreditsMonthly: 'unlimited',
        },
        features: {
          exportEnabled: true,
          advancedExpenses: true,
          advancedAI: true,
          projectComparison: false,
          riskDetection: false,
          autoSummaries: false,
          prioritySupport: false,
        },
      };
    case 'premium':
      return {
        plan: planId,
        limits: {
          activeProjects: 'unlimited',
          documentsPerProject: 'unlimited',
          aiCreditsMonthly: 'unlimited',
        },
        features: {
          exportEnabled: true,
          advancedExpenses: true,
          advancedAI: true,
          projectComparison: true,
          riskDetection: true,
          autoSummaries: true,
          prioritySupport: true,
        },
      };
    default:
      return deriveEntitlements('free');
  }
};

// Billing interface
export interface Billing {
  subscription: {
    planId: Plan;
    billingPeriod: 'monthly' | 'yearly';
    status: 'active' | 'trialing' | 'canceled';
  };
  entitlements: Entitlements;
}

// Derived selector for expenses by category
export interface ExpenseCategorySummary {
  category: string;
  total: number;
  percentage: number;
}

// Phase order for fallback sorting
const PHASE_ORDER = ['Planeamento', 'Design', 'Licenças', 'Construção', 'Acabamentos', 'Concluído'];
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
  addProject: (project: Project) => void;
  // Task management
  tasksByProjectId: Record<string, Task[]>;
  toggleTaskCompletion: (projectId: string, taskId: string) => void;
  getTasksForProject: (projectId: string) => Task[];
  addTask: (projectId: string, task: Omit<Task, 'id' | 'completed'>) => void;
  getNextSteps: (projectId: string, limit?: number) => Task[];
  // Expense management
  expensesByProjectId: Record<string, Expense[]>;
  getExpensesForProject: (projectId: string) => Expense[];
  getRecentExpensesForProject: (projectId: string, limit?: number) => Expense[];
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
  updateResponsible: (projectId: string, responsibleId: string, updates: Partial<Responsible>) => void;
  deleteResponsible: (projectId: string, responsibleId: string) => void;
  getResponsiblesForProject: (projectId: string) => Responsible[];
  // Expense category management
  expenseCategoriesByProjectId: Record<string, ExpenseCategory[]>;
  getExpenseCategoriesForProject: (projectId: string) => ExpenseCategory[];
  getActiveExpenseCategoriesForProject: (projectId: string) => ExpenseCategory[];
  addExpenseCategory: (projectId: string, category: Omit<ExpenseCategory, 'id'>) => void;
  updateExpenseCategory: (projectId: string, categoryId: string, updates: Partial<ExpenseCategory>) => void;
  deleteExpenseCategory: (projectId: string, categoryId: string) => void;
  seedDefaultExpenseCategories: (projectId: string) => void;
  // User profile management
  userProfile: UserProfile;
  setUserProfile: (profile: UserProfile) => void;
  updateUserProfile: (patch: Partial<UserProfile>) => void;
  // Billing management
  billing: Billing;
  setPlanId: (planId: Plan) => void;
  setBillingPeriod: (billingPeriod: 'monthly' | 'yearly') => void;
  // Permission helpers
  can: (featureKey: keyof Entitlements['features']) => boolean;
  getLimit: (limitKey: keyof Entitlements['limits']) => number | 'unlimited';
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

// Initialize expense categories grouped by projectId from mockExpenseCategories
const initializeExpenseCategoriesByProjectId = (): Record<string, ExpenseCategory[]> => {
  const grouped: Record<string, ExpenseCategory[]> = {};
  mockExpenseCategories.forEach(category => {
    if (!grouped[category.projectId]) {
      grouped[category.projectId] = [];
    }
    grouped[category.projectId].push(category);
  });
  return grouped;
};

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      projects: mockProjects,
      activeProjectId: mockProjects[0]?.id ?? '',
      billing: {
        subscription: {
          planId: 'free',
          billingPeriod: 'monthly',
          status: 'active',
        },
        entitlements: deriveEntitlements('free'),
      },
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
      addProject: (project: Project) => {
        set((state) => ({
          projects: [...state.projects, project]
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
          projectId, // Ensure projectId is included
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          completed: false,
        };
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Store Adding Task:', { projectId, newTask });
        }
        
        set((state) => ({
          tasksByProjectId: {
            ...state.tasksByProjectId,
            [projectId]: [...(state.tasksByProjectId[projectId] || []), newTask]
          }
        }));
      },
      updateTask: (projectId: string, taskId: string, updates: Partial<Omit<Task, 'id' | 'projectId'>>) => {
        set((state) => ({
          tasksByProjectId: {
            ...state.tasksByProjectId,
            [projectId]: state.tasksByProjectId[projectId]?.map(task =>
              task.id === taskId
                ? { ...task, ...updates }
                : task
            ) || []
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
      getRecentExpensesForProject: (projectId: string, limit = 4) => {
        const { expensesByProjectId } = get();
        const expenses = expensesByProjectId[projectId] || [];
        
        // Sort by date descending (most recent first)
        const sortedExpenses = [...expenses].sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB.getTime() - dateA.getTime();
        });
        
        return sortedExpenses.slice(0, limit);
      },
      addExpense: (projectId: string, expense: Omit<Expense, 'id'>) => {
        // Ensure the expense has the correct projectId
        const expenseWithProject = {
          ...expense,
          projectId, // Override to ensure correct projectId
        };
        
        const newExpense: Expense = {
          ...expenseWithProject,
          id: `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Store Adding Expense:', { projectId, newExpense });
        }
        
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
          id: `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        
        set((state) => ({
          responsiblesByProjectId: {
            ...state.responsiblesByProjectId,
            [projectId]: [...(state.responsiblesByProjectId[projectId] || []), newResponsible]
          }
        }));
      },
      updateResponsible: (projectId: string, responsibleId: string, updates: Partial<Responsible>) => {
        set((state) => ({
          responsiblesByProjectId: {
            ...state.responsiblesByProjectId,
            [projectId]: state.responsiblesByProjectId[projectId]?.map(responsible =>
              responsible.id === responsibleId
                ? { ...responsible, ...updates }
                : responsible
            ) || []
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
      // Expense category management
      expenseCategoriesByProjectId: initializeExpenseCategoriesByProjectId(),
      getExpenseCategoriesForProject: (projectId: string) => {
        const { expenseCategoriesByProjectId } = get();
        return expenseCategoriesByProjectId[projectId] || [];
      },
      getActiveExpenseCategoriesForProject: (projectId: string) => {
        const { expenseCategoriesByProjectId } = get();
        return (expenseCategoriesByProjectId[projectId] || []).filter(category => category.isActive);
      },
      addExpenseCategory: (projectId: string, category: Omit<ExpenseCategory, 'id'>) => {
        const newCategory: ExpenseCategory = {
          ...category,
          id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        
        set((state) => ({
          expenseCategoriesByProjectId: {
            ...state.expenseCategoriesByProjectId,
            [projectId]: [...(state.expenseCategoriesByProjectId[projectId] || []), newCategory]
          }
        }));
      },
      updateExpenseCategory: (projectId: string, categoryId: string, updates: Partial<ExpenseCategory>) => {
        set((state) => ({
          expenseCategoriesByProjectId: {
            ...state.expenseCategoriesByProjectId,
            [projectId]: state.expenseCategoriesByProjectId[projectId]?.map(category =>
              category.id === categoryId
                ? { ...category, ...updates }
                : category
            ) || []
          }
        }));
      },
      deleteExpenseCategory: (projectId: string, categoryId: string) => {
        set((state) => ({
          expenseCategoriesByProjectId: {
            ...state.expenseCategoriesByProjectId,
            [projectId]: state.expenseCategoriesByProjectId[projectId]?.filter(category =>
              category.id !== categoryId
            ) || []
          }
        }));
      },
      seedDefaultExpenseCategories: (projectId: string) => {
        const { expenseCategoriesByProjectId } = get();
        
        // Only seed if no categories exist for this project
        if (!expenseCategoriesByProjectId[projectId] || expenseCategoriesByProjectId[projectId].length === 0) {
          const defaultCategories = generateDefaultExpenseCategories(projectId);
          
          set((state) => ({
            expenseCategoriesByProjectId: {
              ...state.expenseCategoriesByProjectId,
              [projectId]: defaultCategories
            }
          }));
        }
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
      // User profile management
      userProfile: mockUserProfile,
      setUserProfile: (profile: UserProfile) => {
        set({ userProfile: profile });
      },
      updateUserProfile: (patch: Partial<UserProfile>) => {
        set((state) => ({
          userProfile: { ...state.userProfile, ...patch }
        }));
      },
      // Billing management
      setPlanId: (planId: Plan) => {
        const newEntitlements = deriveEntitlements(planId);
        set((state) => ({
          billing: {
            ...state.billing,
            subscription: {
              ...state.billing.subscription,
              planId
            },
            entitlements: newEntitlements
          }
        }));
      },
      setBillingPeriod: (billingPeriod: 'monthly' | 'yearly') => {
        set((state) => ({
          billing: {
            ...state.billing,
            subscription: {
              ...state.billing.subscription,
              billingPeriod
            }
          }
        }));
      },
      // Permission helpers
      can: (featureKey: keyof Entitlements['features']) => {
        const { billing } = get();
        return billing.entitlements.features[featureKey];
      },
      getLimit: (limitKey: keyof Entitlements['limits']) => {
        const { billing } = get();
        return billing.entitlements.limits[limitKey];
      },
    }),
    {
      name: 'ProjectStore', // Clear name for Redux DevTools
      enabled: process.env.NODE_ENV === 'development', // Only in development
    }
  )
);

// Derived selector function for expenses by category
export const getExpensesByCategorySummary = (projectId: string | undefined): ExpenseCategorySummary[] => {
  if (!projectId) return [];
  
  // Get the store state
  const store = useProjectStore.getState();
  const expenses = store.expensesByProjectId[projectId] || [];
  
  if (expenses.length === 0) return [];
  
  // Group expenses by category and sum amounts
  const categoryTotals = expenses.reduce((acc, expense) => {
    const category = expense.category;
    const amount = typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount;
    
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += isNaN(amount) ? 0 : amount;
    
    return acc;
  }, {} as Record<string, number>);
  
  // Calculate total for percentage computation
  const totalExpenses = Object.values(categoryTotals).reduce((sum, total) => sum + total, 0);
  
  if (totalExpenses === 0) return [];
  
  // Convert to array format and calculate percentages
  const summary = Object.entries(categoryTotals).map(([category, total]) => ({
    category,
    total,
    percentage: Math.round((total / totalExpenses) * 100)
  }));
  
  // Sort by total (descending)
  return summary.sort((a, b) => b.total - a.total);
};
