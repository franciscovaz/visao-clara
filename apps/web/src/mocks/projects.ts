export type Project = {
  id: string;   // stable id, e.g. "proj_1"
  name: string;
  type: string;  // TODO update to enum
  phase: string; // TODO update to enum
  description?: string; // "Descrição / Objetivo"
  address?: string;    // "Morada"
  city?: string;       // "Cidade"
};

export const mockProjects: Project[] = [
  { 
    id: "proj_1", 
    name: "Nova Construção", 
    type: "Casa", 
    phase: "planning",
    description: "Construção de casa familiar com 4 quartos e jardim",
    address: "Rua das Flores, 123",
    city: "Lisboa"
  },
  { 
    id: "proj_2", 
    name: "Reforma Cozinha", 
    type: "Apartamento", 
    phase: "construction",
    description: "Reforma completa da cozinha com móveis planeados",
    address: "Avenida Principal, 456",
    city: "Porto"
  },
  { 
    id: "proj_3", 
    name: "Escritório Comercial", 
    type: "Escritório", 
    phase: "completed",
    description: "Adaptação de espaço comercial para escritório moderno",
    address: "Rua Comércio, 789",
    city: "Cascais"
  },
];
