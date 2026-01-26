export type Project = {
  id: string;   // stable id, e.g. "proj_1"
  name: string;
  type: string;  // TODO update to enum
  phase: string; // TODO update to enum
};

export const mockProjects: Project[] = [
  { id: "proj_1", name: "Nova Construção", type: "Casa", phase: "planning" },
  { id: "proj_2", name: "Reforma Cozinha", type: "Apartamento", phase: "construction" },
  { id: "proj_3", name: "Escritório Comercial", type: "Escritório", phase: "completed" },
];
