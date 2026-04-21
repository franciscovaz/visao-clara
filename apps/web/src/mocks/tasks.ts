// Database-safe phase values (must match tasks_phase_check constraint)
export type TaskPhaseDB = 'planning' | 'design' | 'licensing' | 'construction' | 'finishes' | 'general' | 'done';

// Display labels in Portuguese
export const PHASE_LABELS: Record<TaskPhaseDB, string> = {
  planning: 'Planeamento',
  design: 'Design',
  licensing: 'Licenças',
  construction: 'Construção',
  finishes: 'Acabamentos',
  general: 'Geral',
  done: 'Concluído',
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  phase: TaskPhaseDB;
  dueDate?: string;
  completed: boolean;
};

export const mockTasks: Task[] = [
  // Project 1 - Nova Construção
  { id: "t1", projectId: "proj_1", title: "Contratar arquiteto", phase: "planning", dueDate: "15/01/2026", completed: false },
  { id: "t2", projectId: "proj_1", title: "Aprovar projeto", phase: "planning", dueDate: "20/01/2026", completed: false },
  { id: "t3", projectId: "proj_1", title: "Licença de construção", phase: "licensing", dueDate: "25/01/2026", completed: false },
  { id: "t4", projectId: "proj_1", title: "Fundação", phase: "construction", dueDate: "10/02/2026", completed: false },
  { id: "t5", projectId: "proj_1", title: "Estrutura", phase: "construction", dueDate: "20/02/2026", completed: false },
  { id: "t6", projectId: "proj_1", title: "Instalações elétricas", phase: "construction", dueDate: "01/03/2026", completed: false },
  { id: "t7", projectId: "proj_1", title: "Pintura", phase: "finishes", dueDate: "15/03/2026", completed: false },
  { id: "t8", projectId: "proj_1", title: "Pisos", phase: "finishes", dueDate: "20/03/2026", completed: false },
  
  // Project 2 - Reforma Cozinha
  { id: "t9", projectId: "proj_2", title: "Demolição antiga cozinha", phase: "planning", dueDate: "10/01/2026", completed: true },
  { id: "t10", projectId: "proj_2", title: "Projetar nova cozinha", phase: "design", dueDate: "15/01/2026", completed: false },
  { id: "t11", projectId: "proj_2", title: "Comprar materiais", phase: "planning", dueDate: "20/01/2026", completed: false },
  { id: "t12", projectId: "proj_2", title: "Instalar armários", phase: "construction", dueDate: "25/01/2026", completed: false },
  { id: "t13", projectId: "proj_2", title: "Instalar bancada", phase: "finishes", dueDate: "30/01/2026", completed: false },
  
  // Project 3 - Escritório Comercial
  { id: "t14", projectId: "proj_3", title: "Análise do espaço", phase: "planning", dueDate: "05/01/2026", completed: true },
  { id: "t15", projectId: "proj_3", title: "Layout do escritório", phase: "design", dueDate: "10/01/2026", completed: true },
  { id: "t16", projectId: "proj_3", title: "Reforma elétrica", phase: "construction", dueDate: "15/01/2026", completed: false },
  { id: "t17", projectId: "proj_3", title: "Instalação de ar condicionado", phase: "construction", dueDate: "20/01/2026", completed: false },
  { id: "t18", projectId: "proj_3", title: "Mobiliário", phase: "finishes", dueDate: "25/01/2026", completed: false },
  { id: "t19", projectId: "proj_3", title: "Limpeza final", phase: "general", dueDate: "28/01/2026", completed: false },
  { id: "t20", projectId: "proj_3", title: "Verificação de segurança", phase: "general", dueDate: "30/01/2026", completed: false },
];
