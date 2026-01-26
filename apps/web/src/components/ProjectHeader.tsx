'use client';

import { useState } from 'react';
import { HiPencil } from 'react-icons/hi';
import { useProjectStore } from '@/src/store/projectStore';
import EditProjectModal from '@/components/EditProjectModal';

type ProjectHeaderProps = {
  showEditButton?: boolean;
};

export default function ProjectHeader({ showEditButton = false }: ProjectHeaderProps) {
  const { getActiveProject } = useProjectStore();
  const activeProject = getActiveProject();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (!activeProject) {
    return null;
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{activeProject.name}</h1>
            <p className="text-gray-600 text-lg">{activeProject.type} • Fase: {activeProject.phase}</p>
          </div>
          {showEditButton && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Editar projeto"
            >
              <HiPencil className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="w-full h-px bg-gray-300 mt-4"></div>
      </div>

      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={(updates) => {
          const { updateProject } = useProjectStore.getState();
          updateProject(activeProject.id, updates);
        }}
        project={activeProject}
      />
    </>
  );
}
