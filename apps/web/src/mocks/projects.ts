export type Project = {
  id: string;   // stable id, e.g. "proj_1"
  name: string;
};

export const mockProjects: Project[] = [
  { id: "proj_1", name: "Nova Construção" },
  { id: "proj_2", name: "Reforma Cozinha" },
  { id: "proj_3", name: "Escritório Comercial" },
];
