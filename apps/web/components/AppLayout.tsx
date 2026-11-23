'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  DollarSign,
  Users,
  Sparkles,
  Download,
  MessageSquare,
  Menu,
  X,
  Building2,
  User,
  LogOut,
  Camera,
  type LucideIcon
} from 'lucide-react';
import ProjectDropdown from '@/components/ProjectDropdown';
import { useProjectStore } from '@/src/store/projectStore';
import { useAuthStore } from '@/src/store/authStore';

// Single navigation configuration. Each `id` is both the `currentPage` value and the
// project-scoped route segment (`/<projectId>/<id>`).
type NavItem = { id: string; label: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'checklist', label: 'Checklist', icon: CheckSquare },
  { id: 'documents', label: 'Documentos', icon: FileText },
  { id: 'expenses', label: 'Despesas', icon: DollarSign },
  { id: 'responsaveis', label: 'Resp. de Obra', icon: Users },
  { id: 'ai-assistant', label: 'Assistente IA', icon: Sparkles },
  { id: 'export', label: 'Exportar', icon: Download },
];

// Mobile bottom bar: the first four sections
const BOTTOM_NAV_ITEMS = NAV_ITEMS.slice(0, 4);

const FEEDBACK_NAV_ITEM: NavItem = { id: 'feedback', label: 'Feedback', icon: MessageSquare };

// Desktop sidebar link styles (Figma: text-sm, rounded-md, grey icons, blue active state)
const sidebarLinkClass = (isActive: boolean) =>
  `group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
    isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`;
const sidebarIconClass = (isActive: boolean) =>
  `mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`;

// Full-screen mobile menu items (Figma mobile menu: text-base, py-3, 24px icons)
const mobileMenuItemClass = (isActive: boolean) =>
  `group w-full flex items-center px-2 py-3 text-base font-medium rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
    isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`;
const mobileMenuIconClass = (isActive: boolean) =>
  `mr-3 flex-shrink-0 h-6 w-6 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`;

// Utility function to generate initials from name
const getInitials = (firstName?: string, lastName?: string): string => {
  const first = firstName?.trim() || '';
  const last = lastName?.trim() || '';
  
  if (!first && !last) {
    return 'U'; // Fallback to "U" for User
  }
  
  if (first && !last) {
    return first.charAt(0).toUpperCase();
  }
  
  if (!first && last) {
    return last.charAt(0).toUpperCase();
  }
  
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
};

type AppLayoutProps = {
  children: React.ReactNode;
  currentPage: string;
  showMobileMenu?: boolean;
  onMobileMenuToggle?: () => void;
  onMobileMenuClose?: () => void;
};

export default function AppLayout({
  children,
  currentPage,
  showMobileMenu = false,
  onMobileMenuToggle,
  onMobileMenuClose
}: AppLayoutProps) {
  const router = useRouter();
  const signOut = useAuthStore((state) => state.signOut);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
      // Full navigation drops every in-memory store (projects, tasks, documents,
      // onboarding context) so no previous user's data stays visible
      window.location.replace('/login');
    } catch (error) {
      console.error('Sign out failed:', error instanceof Error ? error.message : error);
      alert('Não foi possível terminar a sessão. Verifique a sua ligação e tente novamente.');
      setIsSigningOut(false);
    }
  };
  const params = useParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(showMobileMenu);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { projects, activeProjectId, setActiveProjectId, getActiveProject, userProfile } = useProjectStore();

  // Use route projectId as source of truth, fallback to store
  const routeProjectId = params.projectId as string | undefined;
  const effectiveProjectId = routeProjectId || activeProjectId || projects[0]?.id;

  // Sync route projectId to store on mount/change (restores selection after refresh)
  useEffect(() => {
    if (routeProjectId && routeProjectId !== activeProjectId) {
      setActiveProjectId(routeProjectId);
    }
  }, [routeProjectId, activeProjectId, setActiveProjectId]);

  const currentProject = getActiveProject();

  // Full-screen mobile menu: the open state stays owned by the page (showMobileMenu / onMobileMenuClose)
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement>(null);
  const onMobileMenuCloseRef = useRef(onMobileMenuClose);
  useEffect(() => {
    onMobileMenuCloseRef.current = onMobileMenuClose;
  });

  useEffect(() => {
    if (!showMobileMenu) return;

    // Lock the page behind the menu, move focus into it, and close it on Escape
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    const menuButton = menuButtonRef.current;
    menuCloseButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      onMobileMenuCloseRef.current?.();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      root.style.overflow = previousOverflow;
      // Back to the hamburger (when the menu closed without leaving the page)
      if (menuButton?.isConnected) menuButton.focus();
    };
  }, [showMobileMenu]);

  // Route for a project-scoped section; '' when there is no project yet (the item is then disabled)
  const getSectionUrl = (section: string) => {
    return effectiveProjectId ? `/${effectiveProjectId}/${section}` : '';
  };

  // Use dynamic initials derived from store values
  const initials = getInitials(userProfile.firstName, userProfile.lastName);

  // Use store user profile data
  const userData = {
    name: `${userProfile.firstName} ${userProfile.lastName}`,
    email: userProfile.email,
    initials // Use dynamic initials instead of hardcoded
  };

  const profileUrl = getSectionUrl('profile');

  // Desktop sidebar entry: a link to the project section, or a disabled item while there is no project
  const renderSidebarItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = currentPage === item.id;
    const href = getSectionUrl(item.id);

    if (!href) {
      return (
        <span
          key={item.id}
          aria-disabled="true"
          className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-400 cursor-not-allowed"
        >
          <Icon className="mr-3 flex-shrink-0 h-5 w-5 text-gray-300" aria-hidden="true" />
          {item.label}
        </span>
      );
    }

    return (
      <Link
        key={item.id}
        href={href}
        aria-current={isActive ? 'page' : undefined}
        className={sidebarLinkClass(isActive)}
      >
        <Icon className={sidebarIconClass(isActive)} aria-hidden="true" />
        {item.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between p-4 bg-white shadow-sm md:hidden">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Visão Clara</h1>
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onMobileMenuToggle}
          aria-label="Abrir menu"
          aria-expanded={showMobileMenu}
          aria-controls="mobile-menu"
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <Menu className="w-6 h-6 text-gray-600" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile Navigation: full-screen panel (no backdrop). h-dvh follows the visible viewport on mobile
          browsers; inset-0 alone is the fallback where dvh is unsupported. Above the header (z-40) and the
          bottom navigation. */}
      {showMobileMenu && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
          className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white md:hidden"
        >
          {/* Menu Header */}
          <div className="flex flex-shrink-0 items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Visão Clara</h2>
            </div>
            <button
              ref={menuCloseButtonRef}
              type="button"
              onClick={onMobileMenuClose}
              aria-label="Fechar menu"
              className="p-2 rounded-md hover:bg-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="w-6 h-6 text-gray-600" aria-hidden="true" />
            </button>
          </div>

          {/* Scrollable content: short screens scroll instead of clipping Feedback or the user menu */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <div className="flex min-h-full flex-col">
              {/* Project Dropdown */}
              <div className="px-4 py-4 border-b border-gray-100">
                <ProjectDropdown
                  onProjectSelect={setActiveProjectId}
                />
              </div>

              {/* Navigation */}
              <nav aria-label="Navegação principal" className="flex-1 px-2 py-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        const sectionUrl = getSectionUrl(item.id);
                        if (sectionUrl) {
                          router.push(sectionUrl);
                        }
                        onMobileMenuClose?.();
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={mobileMenuItemClass(isActive)}
                    >
                      <Icon className={mobileMenuIconClass(isActive)} aria-hidden="true" />
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              {/* Feedback */}
              <div className="px-2 pb-2">
                <div className="border-t border-gray-200 pt-2 mb-2" />
                {(() => {
                  const Icon = FEEDBACK_NAV_ITEM.icon;
                  const isActive = currentPage === FEEDBACK_NAV_ITEM.id;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const feedbackUrl = getSectionUrl(FEEDBACK_NAV_ITEM.id);
                        if (feedbackUrl) {
                          router.push(feedbackUrl);
                        }
                        onMobileMenuClose?.();
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      className={mobileMenuItemClass(isActive)}
                    >
                      <Icon className={mobileMenuIconClass(isActive)} aria-hidden="true" />
                      {FEEDBACK_NAV_ITEM.label}
                    </button>
                  );
                })()}
              </div>

              {/* User Section */}
              <div className="border-t border-gray-200 px-2 pt-4 pb-6">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    aria-expanded={isUserMenuOpen}
                    aria-controls="mobile-user-menu"
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-left hover:bg-gray-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <div className="w-8 h-8 flex-shrink-0 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {userData.initials}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">{userData.name}</span>
                      <span className="text-xs text-gray-500 truncate">{userData.email}</span>
                    </div>
                  </button>

                  {/* User Menu Dropdown */}
                  {isUserMenuOpen && (
                    <div
                      id="mobile-user-menu"
                      className="absolute bottom-full left-0 right-0 mb-2 p-1 bg-white border border-gray-200 rounded-md shadow-lg z-50"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (profileUrl) {
                            router.push(profileUrl);
                          }
                          setIsUserMenuOpen(false);
                          onMobileMenuClose?.();
                        }}
                        className="w-full flex items-center px-2 py-2 text-sm text-gray-700 rounded-sm hover:bg-gray-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <User className="mr-2 w-4 h-4 text-gray-500" aria-hidden="true" />
                        Meu Perfil
                      </button>
                      <div className="-mx-1 my-1 h-px bg-gray-200" />
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onMobileMenuClose?.();
                          handleLogout();
                        }}
                        disabled={isSigningOut}
                        className="w-full flex items-center px-2 py-2 text-sm text-red-600 rounded-sm hover:bg-red-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <LogOut className="mr-2 w-4 h-4" aria-hidden="true" />
                        Sair
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar: fixed, so navigation, Feedback and the user menu stay in view while the page scrolls.
          z-40 because position: fixed creates a stacking context: overlays rendered inside the sidebar
          (project dropdown, AddProjectWizard) must paint above the page content. */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-64 md:flex-col">
        {/* No overflow on this container: it would clip the project dropdown, which is wider than the sidebar.
            Only the navigation list scrolls on short viewports. */}
        <div className="flex h-full flex-col bg-white border-r border-gray-200 pt-5 pb-4">
          <div className="flex items-center flex-shrink-0 px-4 mb-8">
            <Building2 className="w-8 h-8 text-blue-600 mr-3" aria-hidden="true" />
            <span className="text-xl font-bold text-gray-900">Visão Clara</span>
          </div>

          {/* Project Dropdown */}
          <div className="px-4 mb-4">
            <ProjectDropdown
              onProjectSelect={setActiveProjectId}
            />
          </div>

          <div className="mx-4 mb-4 border-t border-gray-200" />

          <nav aria-label="Navegação principal" className="flex-1 min-h-0 overflow-y-auto px-2 space-y-1">
            {NAV_ITEMS.map((item) => renderSidebarItem(item))}
          </nav>

          {/* Feedback at bottom */}
          <div className="px-2 pb-2 space-y-1">
            <div className="border-t border-gray-200 pt-2 mb-2" />
            {renderSidebarItem(FEEDBACK_NAV_ITEM)}
          </div>

          {/* User Section */}
          <div className="border-t border-gray-200 pt-4 px-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                aria-expanded={isUserMenuOpen}
                aria-controls="sidebar-user-menu"
                className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-left hover:bg-gray-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="w-8 h-8 flex-shrink-0 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {userData.initials}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate">{userData.name}</span>
                  <span className="text-xs text-gray-500 truncate">{userData.email}</span>
                </div>
              </button>

              {/* User Menu Dropdown */}
              {isUserMenuOpen && (
                <div
                  id="sidebar-user-menu"
                  className="absolute bottom-full left-0 right-0 mb-2 p-1 bg-white border border-gray-200 rounded-md shadow-lg z-50"
                >
                  {profileUrl ? (
                    <Link
                      href={profileUrl}
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center px-2 py-1.5 text-sm text-gray-700 rounded-sm hover:bg-gray-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <User className="mr-2 w-4 h-4 text-gray-500" aria-hidden="true" />
                      Meu Perfil
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="w-full flex items-center px-2 py-1.5 text-sm text-gray-400 rounded-sm cursor-not-allowed"
                    >
                      <User className="mr-2 w-4 h-4" aria-hidden="true" />
                      Meu Perfil
                    </span>
                  )}
                  <div className="-mx-1 my-1 h-px bg-gray-200" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleLogout();
                    }}
                    disabled={isSigningOut}
                    className="w-full flex items-center px-2 py-1.5 text-sm text-red-600 rounded-sm hover:bg-red-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LogOut className="mr-2 w-4 h-4" aria-hidden="true" />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content (offset by the fixed sidebar on desktop) */}
      <div className="md:pl-64">
        <main className="p-4 md:p-6 pt-20 md:pt-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden">
        <div className="grid grid-cols-4 py-2">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  const sectionUrl = getSectionUrl(item.id);
                  if (sectionUrl) {
                    router.push(sectionUrl);
                  }
                }}
                className={`flex flex-col items-center py-2 space-y-1 ${
                  currentPage === item.id ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
