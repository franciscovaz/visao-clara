export type Document = {
  id: string;
  projectId: string;
  name: string;
  date: string;
  type: 'PDF' | 'EXCEL' | 'OTHER';
};

export const mockDocuments: Document[] = [
  // Project 1 - Nova Construção
  { id: "d1", projectId: "proj_1", name: "Orçamento_obra.xlsx", date: "15/01/2026", type: "EXCEL" },
  { id: "d2", projectId: "proj_1", name: "Contrato_obra.pdf", date: "20/01/2026", type: "PDF" },
  { id: "d3", projectId: "proj_1", name: "Plantas_arquitetônicas.dwg", date: "25/01/2026", type: "OTHER" },
  { id: "d4", projectId: "proj_1", name: "Alvará_construção.pdf", date: "30/01/2026", type: "PDF" },
  
  // Project 2 - Reforma Cozinha
  { id: "d5", projectId: "proj_2", name: "Projeto_cozinha.pdf", date: "10/01/2026", type: "PDF" },
  { id: "d6", projectId: "proj_2", name: "Orçamento_materiais.xlsx", date: "15/01/2026", type: "EXCEL" },
  { id: "d7", projectId: "proj_2", name: "Medições_espaço.pdf", date: "20/01/2026", type: "PDF" },
  
  // Project 3 - Escritório Comercial
  { id: "d8", projectId: "proj_3", name: "Layout_escritório.pdf", date: "05/01/2026", type: "PDF" },
  { id: "d9", projectId: "proj_3", name: "Contrato_aluguel.pdf", date: "10/01/2026", type: "PDF" },
  { id: "d10", projectId: "proj_3", name: "Especificações_técnicas.pdf", date: "15/01/2026", type: "PDF" },
];
