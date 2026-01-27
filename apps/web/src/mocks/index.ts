export * from './projects';
export * from './activeProject';
export * from './tasks';

export interface Document {
  id: string;
  projectId: string;
  name: string;
  type: 'PDF' | 'EXCEL' | 'OTHER';
  phase: string;
  date: string;
}

export interface Responsible {
  id: string;
  projectId: string;
  name: string;
  company: string;
  role: 'Arquiteto' | 'Empreiteiro' | 'Engenheiro Civil' | 'Fiscalização' | 'Outro';
  email: string;
  phone: string;
  city: string;
}

export * from './documents';
export * from './expenses';
export * from './responsibles';
