'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HiHome, HiOfficeBuilding, HiPlus, HiCheck, HiLockClosed } from 'react-icons/hi';
import { useProjectStore } from '@/src/store/projectStore';
import { Project } from '@/src/mocks';
import AddProjectWizard from '@/components/AddProjectWizard';

type ProjectDropdownProps = {
  className?: string;
  onProjectSelect?: (id: string) => void;
};

export default function ProjectDropdown({ className = '', onProjectSelect }: ProjectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Use projects from store
  const { projects, activeProjectId, setActiveProjectId, getActiveProject, getLimit } = useProjectStore();
  const currentProject = getActiveProject();
  
  // Check if project limit is reached (for FREE plan)
  const activeProjectsLimit = getLimit('activeProjects');
  const isLocked = typeof activeProjectsLimit === 'number' && projects.length >= activeProjectsLimit;
  
  // Handle Pro pill click - navigate to billing tab
  const handleProPillClick = () => {
    const projectId = currentProject?.id || projects[0]?.id || '';
    router.replace(`/${projectId}/profile?tab=plans`);
  };
  
  // Handle Pro pill click with stopPropagation for Link
  const handleProPillLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const projectId = currentProject?.id || projects[0]?.id || '';
    router.push(`/${projectId}/profile?tab=plans`);
  };

  // Close dropdown when clicking outside or pressing ESC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleProjectSelect = (project: Project) => {
    // Only update route if project is actually changing
    if (project.id !== activeProjectId) {
      // Get current pathname and extract the section
      const pathname = window.location.pathname;
      const pathSegments = pathname.split('/').filter(Boolean);
      
      // If current path has a projectId, replace it with the new one
      if (pathSegments.length >= 2 && projects.some(p => p.id === pathSegments[0])) {
        // Keep the current section (everything after the projectId)
        const section = pathSegments.slice(1).join('/');
        const newPath = `/${project.id}/${section}`;
        router.replace(newPath);
      } else {
        // Fallback: navigate to dashboard for the new project
        router.replace(`/${project.id}/dashboard`);
      }
    }
    
    // Update the selected project in store
    const selectFn = onProjectSelect || setActiveProjectId;
    selectFn(project.id);
    setIsOpen(false);
  };

  const CurrentIcon = HiHome; // Default icon for all projects

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-full text-left"
      >
        <CurrentIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-900 truncate">{currentProject?.name || 'Select Project'}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-auto ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-[60]">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">YOUR PROJECTS</h3>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {projects.map((project) => {
              const Icon = HiHome; // Default icon for all projects
              const isActive = project.id === currentProject?.id;
              
              return (
                <button
                  key={project.id}
                  onClick={() => handleProjectSelect(project)}
                  className={`w-full px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 transition-colors ${
                    isActive ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-600'}`} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className={`text-sm font-medium truncate ${
                        isActive ? 'text-blue-900' : 'text-gray-900'
                      }`}>
                        {project.name}
                      </p>
                      {isActive && (
                        <HiCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {project.type} • Fase: {project.phase}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-200">
            <button
              onClick={() => {
                if (isLocked) {
                  // Don't open wizard if locked
                  return;
                }
                setIsWizardOpen(true);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 flex items-center space-x-3 transition-colors ${
                isLocked 
                  ? 'bg-gray-50 cursor-not-allowed' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isLocked ? 'bg-gray-200' : 'bg-gray-100'
              }`}>
                {isLocked ? (
                  <HiLockClosed className="w-4 h-4 text-gray-400" />
                ) : (
                  <HiPlus className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between relative">
                  <p className={`text-sm font-medium ${
                    isLocked ? 'text-gray-400' : 'text-gray-900'
                  }`}>
                    Adicionar novo projeto
                  </p>
                  {isLocked && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={handleProPillLinkClick}
                      className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-full hover:bg-blue-700 transition-colors cursor-pointer relative z-10"
                    >
                      Pro
                    </span>
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Add Project Wizard */}
      <AddProjectWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </div>
  );
}
