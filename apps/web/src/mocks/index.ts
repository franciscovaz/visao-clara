export * from './projects';
export * from './activeProject';
export * from './tasks';
export * from './documents';
export * from './expenses';
export * from './responsibles';
export * from './userProfile';
export * from './expenseCategories';

export interface Document {
  id: string;
  projectId: string;
  name: string;
  date: string;
  type: 'PDF' | 'EXCEL' | 'OTHER';
}

export interface Responsible {
  id: string;
  projectId: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  city: string;
}
