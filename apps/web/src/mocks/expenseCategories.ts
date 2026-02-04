export type ExpenseCategory = {
  id: string;
  projectId: string;
  name: string;
  isActive: boolean;
};

// Default categories for new projects (Portuguese labels)
export const DEFAULT_EXPENSE_CATEGORIES = [
  'Materiais',
  'Mão de obra',
  'Serviços',
  'Equipamentos e ferramentas',
  'Transporte',
  'Subempreitadas',
  'Reparações e ajustes',
  'Limpeza e resíduos',
  'Licenças e taxas',
  'Imprevistos',
  'Outros'
];

// Generate default categories for a project
export const generateDefaultExpenseCategories = (projectId: string): ExpenseCategory[] => {
  return DEFAULT_EXPENSE_CATEGORIES.map((name, index) => ({
    id: `cat_${projectId}_${index + 1}`,
    projectId,
    name,
    isActive: true
  }));
};

// Mock data for existing projects
export const mockExpenseCategories: ExpenseCategory[] = [
  // Project 1 - Nova Construção
  ...generateDefaultExpenseCategories('proj_1'),
  
  // Project 2 - Reforma Cozinha  
  ...generateDefaultExpenseCategories('proj_2'),
  
  // Project 3 - Escritório
  ...generateDefaultExpenseCategories('proj_3'),
];
