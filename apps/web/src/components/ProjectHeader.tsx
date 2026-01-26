'use client';

import { useProjectStore } from '@/src/store/projectStore';

export default function ProjectHeader() {
  const { getActiveProject } = useProjectStore();
  const activeProject = getActiveProject();

  if (!activeProject) {
    return null;
  }

  return (
    <div className="mb-6">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{activeProject.name}</h1>
      <p className="text-gray-600 text-lg">{activeProject.type} • Fase: {activeProject.phase}</p>
      <div className="w-full h-px bg-gray-300 mt-4"></div>
    </div>
  );
}
