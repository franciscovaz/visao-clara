export type Expense = {
  id: string;
  projectId: string;
  description: string;
  supplier: string;
  category: string;
  amount: number;
  date: string;
};

export const mockExpenses: Expense[] = [
  // Project 1 - Nova Construção
  { id: "e1", projectId: "proj_1", description: "Material de construção", supplier: "ConstruçãoMart", category: "Materiais", amount: 5000, date: "15/01/2026" },
  { id: "e2", projectId: "proj_1", description: "Mão de obra", supplier: "ServiçosBuild", category: "Mão de Obra", amount: 3000, date: "20/01/2026" },
  { id: "e3", projectId: "proj_1", description: "Equipamentos", supplier: "ToolRent", category: "Aluguel", amount: 800, date: "25/01/2026" },
  { id: "e4", projectId: "proj_1", description: "Taxa de licença", supplier: "Prefeitura", category: "Taxas", amount: 500, date: "30/01/2026" },
  
  // Project 2 - Reforma Cozinha
  { id: "e5", projectId: "proj_2", description: "Armários de cozinha", supplier: "CozinhaShow", category: "Móveis", amount: 2500, date: "10/01/2026" },
  { id: "e6", projectId: "proj_2", description: "Bancada de granito", supplier: "GranitoPlus", category: "Materiais", amount: 1800, date: "15/01/2026" },
  { id: "e7", projectId: "proj_2", description: "Eletrodomésticos", supplier: "LojaEletro", category: "Equipamentos", amount: 3200, date: "20/01/2026" },
  
  // Project 3 - Escritório Comercial
  { id: "e8", projectId: "proj_3", description: "Ar condicionado", supplier: "ClimaTech", category: "Equipamentos", amount: 1500, date: "05/01/2026" },
  { id: "e9", projectId: "proj_3", description: "Mobiliário de escritório", supplier: "OfficeFurn", category: "Móveis", amount: 2200, date: "10/01/2026" },
  { id: "e10", projectId: "proj_3", description: "Instalação elétrica", supplier: "EletricistaPro", category: "Serviços", amount: 900, date: "15/01/2026" },
];
