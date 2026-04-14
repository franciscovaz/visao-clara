export type Project = {
  id: string;   // stable id, e.g. "proj_1"
  name: string;
  type: string;  // TODO update to enum
  propertyType?: string; // Type of property (Casa, Apartamento, Outro)
  phase: string; // TODO update to enum
  mainGoal?: string; // Main goal of the project
  estimatedBudget?: number; // Estimated budget in EUR
  budget?: string; // Budget from backend (EUR as string)
  description?: string; // "Descrição / Objetivo"
  address?: string;    // "Morada"
  city?: string;       // "Cidade"
  projectTypeDescription?: string; // Description for 'other' project type
};

export const mockProjects: Project[] = [
  { 
    id: "proj_1", 
    name: "Nova Construção", 
    type: "Casa", 
    phase: "planning",
    description: "Construção de casa familiar com 4 quartos e jardim",
    address: "Rua das Flores, 123",
    city: "Lisboa",
    budget: "150000"
  },
  { 
    id: "proj_2", 
    name: "Reforma Cozinha", 
    type: "Apartamento", 
    phase: "construction",
    description: "Reforma completa da cozinha com móveis planeados",
    budget: "25000",
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
    city: "Porto",
    budget: "75000"
  }
];
