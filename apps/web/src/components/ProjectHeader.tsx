'use client';

import { Pencil } from 'lucide-react';
import { useProjectStore } from '@/src/store/projectStore';
import { Button } from '@/components/ui/Button';
import { getProjectPhaseLabel, getProjectTypeLabel } from '@/src/utils/projectPresentation';

type ProjectHeaderProps = {
  /** Kept for compatibility; the edit button is shown only when `onEdit` is provided. */
  showEditButton?: boolean;
  onEdit?: () => void;
};

export default function ProjectHeader({ showEditButton, onEdit }: ProjectHeaderProps) {
  const { getActiveProject } = useProjectStore();
  const activeProject = getActiveProject();

  if (!activeProject) {
    return null;
  }

  const canEdit = Boolean(onEdit) && showEditButton !== false;
  const typeLabel = getProjectTypeLabel(activeProject);
  const phaseLabel = getProjectPhaseLabel(activeProject);
  const details = [typeLabel && `Tipo de projeto: ${typeLabel}`, phaseLabel && `Fase atual: ${phaseLabel}`]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="mb-6 flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
      <div className="min-w-0 flex-1">
        <h1 className="break-words text-2xl font-semibold text-gray-900">{activeProject.name}</h1>
        {details && <p className="mt-1 break-words text-sm text-gray-500">{details}</p>}
      </div>
      {canEdit && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onEdit}
          aria-label="Editar projeto"
          title="Editar projeto"
          className="mt-0.5 flex-shrink-0 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
