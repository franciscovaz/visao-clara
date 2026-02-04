export type Task = {
  id: string;
  projectId: string;
  title: string;
  phase: string;
  dueDate?: string;
  completed: boolean;
};

export const mockTasks: Task[] = [
  // Project 1 - Nova Construção
  { id: "t1", projectId: "proj_1", title: "Contratar arquiteto", phase: "Planeamento", dueDate: "15/01/2026", completed: false },
  { id: "t2", projectId: "proj_1", title: "Aprovar projeto", phase: "Planeamento", dueDate: "20/01/2026", completed: false },
  { id: "t3", projectId: "proj_1", title: "Licença de construção", phase: "Licenças", dueDate: "25/01/2026", completed: false },
  { id: "t4", projectId: "proj_1", title: "Fundação", phase: "Construção", dueDate: "10/02/2026", completed: false },
  { id: "t5", projectId: "proj_1", title: "Estrutura", phase: "Construção", dueDate: "20/02/2026", completed: false },
  { id: "t6", projectId: "proj_1", title: "Instalações elétricas", phase: "Construção", dueDate: "01/03/2026", completed: false },
  { id: "t7", projectId: "proj_1", title: "Pintura", phase: "Acabamentos", dueDate: "15/03/2026", completed: false },
  { id: "t8", projectId: "proj_1", title: "Pisos", phase: "Acabamentos", dueDate: "20/03/2026", completed: false },
  
  // Project 2 - Reforma Cozinha
  { id: "t9", projectId: "proj_2", title: "Demolição antiga cozinha", phase: "Planeamento", dueDate: "10/01/2026", completed: true },
  { id: "t10", projectId: "proj_2", title: "Projetar nova cozinha", phase: "Design", dueDate: "15/01/2026", completed: false },
  { id: "t11", projectId: "proj_2", title: "Comprar materiais", phase: "Planeamento", dueDate: "20/01/2026", completed: false },
  { id: "t12", projectId: "proj_2", title: "Instalar armários", phase: "Construção", dueDate: "25/01/2026", completed: false },
  { id: "t13", projectId: "proj_2", title: "Instalar bancada", phase: "Acabamentos", dueDate: "30/01/2026", completed: false },
  
  // Project 3 - Escritório Comercial
  { id: "t14", projectId: "proj_3", title: "Análise do espaço", phase: "Planeamento", dueDate: "05/01/2026", completed: true },
  { id: "t15", projectId: "proj_3", title: "Layout do escritório", phase: "Design", dueDate: "10/01/2026", completed: true },
  { id: "t16", projectId: "proj_3", title: "Reforma elétrica", phase: "Construção", dueDate: "15/01/2026", completed: false },
  { id: "t17", projectId: "proj_3", title: "Instalação de ar condicionado", phase: "Construção", dueDate: "20/01/2026", completed: false },
  { id: "t18", projectId: "proj_3", title: "Mobiliário", phase: "Acabamentos", dueDate: "25/01/2026", completed: false },
];
