import { Responsible } from './index';

export const mockResponsibles: Responsible[] = [
  // Project 1 - Nova Construção (4 responsibles)
  {
    id: 'resp_1',
    projectId: '1',
    name: 'João Silva',
    company: 'Arquitetura & Design Lda.',
    role: 'architect',
    email: 'joao.silva@arquitetura.pt',
    phone: '+351 912 345 678',
    city: 'Lisboa'
  },
  {
    id: 'resp_2',
    projectId: '1',
    name: 'Manuel Santos',
    company: 'Construções Santos S.A.',
    role: 'contractor',
    email: 'manuel.santos@construcoes-santos.pt',
    phone: '+351 923 456 789',
    city: 'Porto'
  },
  {
    id: 'resp_3',
    projectId: '1',
    name: 'Ana Costa',
    company: 'Engenharia Costa & Associados',
    role: 'civil_engineer',
    email: 'ana.costa@engenharia-costa.pt',
    phone: '+351 934 567 890',
    city: 'Lisboa'
  },
  {
    id: 'resp_4',
    projectId: '1',
    name: 'Carlos Mendes',
    company: 'Fiscalização Obras Norte',
    role: 'supervisor',
    email: 'carlos.mendes@fiscalizacao-norte.pt',
    phone: '+351 945 678 901',
    city: 'Porto'
  },
  
  // Project 2 - Renovação Cozinha (2 responsibles)
  {
    id: 'resp_5',
    projectId: '2',
    name: 'Pedro Oliveira',
    company: 'Renovações Express',
    role: 'contractor',
    email: 'pedro.oliveira@renovacoes-express.pt',
    phone: '+351 967 890 123',
    city: 'Cascais'
  },
  {
    id: 'resp_6',
    projectId: '2',
    name: 'Teresa Almeida',
    company: 'Arquitetura Almeida',
    role: 'architect',
    email: 'teresa.almeida@arquitetura-almeida.pt',
    phone: '+351 978 901 234',
    city: 'Cascais'
  }
];
