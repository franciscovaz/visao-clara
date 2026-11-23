'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Lock, Plus } from 'lucide-react';
import { useProjectStore } from '@/src/store/projectStore';
import { Project } from '@/src/mocks';
import AddProjectWizard from '@/components/AddProjectWizard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { getProjectTypeLabel, getProjectTypeStyle } from '@/src/utils/projectPresentation';

type ProjectDropdownProps = {
  className?: string;
  onProjectSelect?: (id: string) => void;
};

const menuItemClass =
  'w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-colors outline-none focus-visible:bg-gray-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

function ProjectTypeIcon({ project, size = 'md' }: { project?: Project | null; size?: 'sm' | 'md' }) {
  const { icon: Icon, className } = getProjectTypeStyle(project);
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex flex-shrink-0 items-center justify-center rounded',
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8 rounded-md',
        className
      )}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export default function ProjectDropdown({ className = '', onProjectSelect }: ProjectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const labelId = useId();
  const router = useRouter();

  // Use projects from store
  const { projects, activeProjectId, setActiveProjectId, getActiveProject, getLimit } = useProjectStore();
  const currentProject = getActiveProject();

  // Check if project limit is reached (for FREE plan)
  const activeProjectsLimit = getLimit('activeProjects');
  const isLocked = typeof activeProjectsLimit === 'number' && projects.length >= activeProjectsLimit;

  const closeMenu = (returnFocus = false) => {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const getMenuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? []);

  // On open, move focus to the selected project (or the first item) so the arrow keys work straight away
  useEffect(() => {
    if (!isOpen) return;
    const items = getMenuItems();
    const selected = items.find((item) => item.getAttribute('aria-checked') === 'true');
    (selected ?? items[0])?.focus();
  }, [isOpen]);

  // Close dropdown when clicking outside or pressing ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    // Capture phase + preventDefault: Escape closes only the dropdown, not the mobile menu or a modal around it
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      // Leave the menu with the natural tab order
      setIsOpen(false);
      return;
    }

    const items = getMenuItems();
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;

    if (event.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;

    if (next !== null) {
      event.preventDefault();
      items[next].focus();
    }
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
    }
  };

  // Locked plan: the "add project" row leads to the plans tab of the profile
  const handleUpgradeClick = () => {
    const projectId = currentProject?.id || projects[0]?.id || '';
    closeMenu();
    router.push(`/${projectId}/profile?tab=plans`);
  };

  const handleAddProjectClick = () => {
    closeMenu();
    setIsWizardOpen(true);
  };

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

    closeMenu(true);
    // Update the selected project in store (the caller may also close surrounding menus)
    const selectFn = onProjectSelect || setActiveProjectId;
    selectFn(project.id);
  };

  const currentTypeLabel = getProjectTypeLabel(currentProject);

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={
          currentProject
            ? `Selecionar projeto. Projeto atual: ${currentProject.name}${currentTypeLabel ? `, ${currentTypeLabel}` : ''}`
            : 'Selecionar projeto'
        }
        className="h-10 w-full justify-between gap-2 border-gray-200 px-3 hover:bg-gray-50 hover:text-gray-900"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ProjectTypeIcon project={currentProject} size="sm" />
          <span className="truncate text-sm font-medium text-gray-900">
            {currentProject?.name || 'Selecionar projeto'}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn('h-4 w-4 flex-shrink-0 text-gray-500 transition-transform', isOpen && 'rotate-180')}
        />
      </Button>

      {isOpen && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-labelledby={labelId}
          onKeyDown={handleMenuKeyDown}
          // Mobile menu: as wide as the trigger. Desktop sidebar: wider than the sidebar (it has no overflow clipping).
          className="absolute left-0 top-full z-[60] mt-1 w-full rounded-lg border border-gray-200 bg-white p-1 shadow-lg md:w-80"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <p id={labelId} className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Os meus projetos
            </p>
            <span
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500"
              aria-label={`${projects.length} ${projects.length === 1 ? 'projeto' : 'projetos'}`}
            >
              {projects.length}
            </span>
          </div>

          {projects.length > 0 && (
            <div role="group" aria-labelledby={labelId} className="max-h-64 overflow-y-auto">
              {projects.map((project) => {
                const isActive = project.id === currentProject?.id;
                const typeLabel = getProjectTypeLabel(project);

                return (
                  <button
                    key={project.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    tabIndex={-1}
                    onClick={() => handleProjectSelect(project)}
                    className={cn(menuItemClass, isActive ? 'bg-blue-50 hover:bg-blue-50' : 'hover:bg-gray-50')}
                  >
                    <ProjectTypeIcon project={project} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn('truncate text-sm font-medium', isActive ? 'text-blue-700' : 'text-gray-900')}>
                        {project.name}
                      </span>
                      {typeLabel && <span className="truncate text-xs text-gray-500">{typeLabel}</span>}
                    </span>
                    {isActive && <Check aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-blue-600" />}
                  </button>
                );
              })}
            </div>
          )}

          <div role="separator" className="-mx-1 my-1 h-px bg-gray-200" />

          {/* A single interactive element in both states (no nested button for the Pro badge) */}
          {isLocked ? (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={handleUpgradeClick}
              aria-label="Adicionar novo projeto: limite do plano atingido. Ver planos Pro"
              className={cn(menuItemClass, 'hover:bg-gray-50')}
            >
              <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gray-100">
                <Lock className="h-4 w-4 text-gray-400" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-gray-500">Adicionar novo projeto</span>
                <span className="truncate text-xs text-gray-400">Limite do plano atingido</span>
              </span>
              <Badge className="flex-shrink-0 border-transparent bg-blue-600 text-white">Pro</Badge>
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={handleAddProjectClick}
              className={cn(menuItemClass, 'text-blue-600 hover:bg-blue-50')}
            >
              <span aria-hidden="true" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-blue-50">
                <Plus className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-medium">Adicionar novo projeto</span>
            </button>
          )}
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
