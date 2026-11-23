import { Building, FolderKanban, Hammer, Home, TrendingUp, type LucideIcon } from 'lucide-react';

/**
 * Presentation-only helpers for project type and phase (labels, icon, colours).
 *
 * Projects in the store are not mapped consistently: `type`/`phase` can hold the raw DB value
 * (`new-construction`, `investment`, `design`), an already translated label (`Renovação`), or free text
 * for "other" projects. Store objects loaded from Supabase also carry the raw `project_type` and
 * `current_phase` columns. These helpers accept any of those shapes and never change the stored values.
 */

export type ProjectTypeKey = 'new-construction' | 'renovation' | 'purchase-with-works' | 'investment' | 'other';

type ProjectLike = {
  type?: string | null;
  phase?: string | null;
  projectTypeDescription?: string | null;
  // Raw DB columns present on store objects hydrated from Supabase (not declared on `Project`)
  project_type?: string | null;
  project_description?: string | null;
  current_phase?: string | null;
};

const PROJECT_TYPE_LABELS: Record<ProjectTypeKey, string> = {
  'new-construction': 'Nova Construção',
  renovation: 'Renovação',
  'purchase-with-works': 'Compra + Obras',
  investment: 'Investimento',
  other: 'Outro',
};

// Raw values (both spellings in use) and labels written into the store by older mappings
const PROJECT_TYPE_ALIASES: Record<string, ProjectTypeKey> = {
  'new-construction': 'new-construction',
  new_construction: 'new-construction',
  'nova construção': 'new-construction',
  'construção nova': 'new-construction',
  renovation: 'renovation',
  'renovação': 'renovation',
  'purchase-with-works': 'purchase-with-works',
  purchase_with_works: 'purchase-with-works',
  'compra + obras': 'purchase-with-works',
  investment: 'investment',
  investimento: 'investment',
  other: 'other',
  outro: 'other',
};

const PROJECT_TYPE_STYLES: Record<ProjectTypeKey | 'unknown', { icon: LucideIcon; className: string }> = {
  'new-construction': { icon: Building, className: 'bg-blue-100 text-blue-600' },
  renovation: { icon: Hammer, className: 'bg-orange-100 text-orange-600' },
  'purchase-with-works': { icon: Home, className: 'bg-green-100 text-green-600' },
  investment: { icon: TrendingUp, className: 'bg-purple-100 text-purple-600' },
  other: { icon: FolderKanban, className: 'bg-gray-100 text-gray-600' },
  unknown: { icon: FolderKanban, className: 'bg-gray-100 text-gray-600' },
};

const PHASE_LABELS: Record<string, string> = {
  planning: 'Planeamento',
  planeamento: 'Planeamento',
  design: 'Design',
  licenses: 'Licenças',
  'licenças': 'Licenças',
  construction: 'Construção',
  'construção': 'Construção',
  finishing: 'Acabamentos',
  acabamentos: 'Acabamentos',
  completed: 'Concluído',
  'concluído': 'Concluído',
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const toTypeKey = (value?: string | null): ProjectTypeKey | null => PROJECT_TYPE_ALIASES[normalize(value)] ?? null;

export function getProjectTypeKey(project?: ProjectLike | null): ProjectTypeKey | null {
  if (!project) return null;
  return toTypeKey(project.project_type) ?? toTypeKey(project.type);
}

/** pt-PT label for the project type. "Other" projects show their own description when there is one. */
export function getProjectTypeLabel(project?: ProjectLike | null): string {
  if (!project) return '';
  const key = getProjectTypeKey(project);

  if (key && key !== 'other') return PROJECT_TYPE_LABELS[key];

  // "Other" or free text (some flows store the description itself as the type)
  const freeText = [project.type, project.project_type, project.projectTypeDescription, project.project_description]
    .map((value) => value?.trim() ?? '')
    .find((value) => value && !toTypeKey(value));

  return freeText || (key === 'other' ? PROJECT_TYPE_LABELS.other : '');
}

export function getProjectTypeStyle(project?: ProjectLike | null) {
  return PROJECT_TYPE_STYLES[getProjectTypeKey(project) ?? 'unknown'];
}

/** pt-PT label for the project phase (raw `current_phase` or an already translated value). */
export function getProjectPhaseLabel(project?: ProjectLike | null): string {
  if (!project) return '';
  return PHASE_LABELS[normalize(project.current_phase)] ?? PHASE_LABELS[normalize(project.phase)] ?? project.phase?.trim() ?? '';
}
