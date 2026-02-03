'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  ChevronDown,
  User,
  LogOut,
  Camera
} from 'lucide-react';
import ProjectDropdown from '@/components/ProjectDropdown';
import { useProjectStore } from '@/src/store/projectStore';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(showMobileMenu);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { projects, activeProjectId, setActiveProjectId, getActiveProject, userProfile } = useProjectStore();
  const currentProject = getActiveProject();

  const getExpensesUrl = () => {
    const currentProjectId = activeProjectId || projects[0]?.id;
    return currentProjectId ? `/${currentProjectId}/expenses` : '';
  };

  const getDocumentsUrl = () => {
    const currentProjectId = activeProjectId || projects[0]?.id;
    return currentProjectId ? `/${currentProjectId}/documents` : '';
  };

  const getChecklistUrl = () => {
    const currentProjectId = activeProjectId || projects[0]?.id;
    return currentProjectId ? `/${currentProjectId}/checklist` : '';
  };

  const getResponsaveisUrl = () => {
    const currentProjectId = activeProjectId || projects[0]?.id;
    return currentProjectId ? `/${currentProjectId}/responsaveis` : '';
  };

  const getExportUrl = () => {
    const currentProjectId = activeProjectId || projects[0]?.id;
    return currentProjectId ? `/${currentProjectId}/export` : '';
  };

  const getFeedbackUrl = () => {
    const currentProjectId = activeProjectId || projects[0]?.id;
    return currentProjectId ? `/${currentProjectId}/feedback` : '';
  };

  // Use dynamic initials derived from store values
  const initials = getInitials(userProfile.firstName, userProfile.lastName);

  // Use store user profile data
  const userData = {
    name: `${userProfile.firstName} ${userProfile.lastName}`,
    email: userProfile.email,
    initials // Use dynamic initials instead of hardcoded
  };

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'checklist', label: 'Checklist', icon: CheckSquare },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'expenses', label: 'Despesas', icon: DollarSign },
    { id: 'responsaveis', label: 'Resp. de Obra', icon: Users },
    { id: 'ai-assistant', label: 'Assistente IA', icon: Sparkles },
    { id: 'export', label: 'Exportar', icon: Download },
  ];

  const bottomNavigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'checklist', label: 'Checklist', icon: CheckSquare },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'expenses', label: 'Despesas', icon: DollarSign },
  ];

  const feedbackNavigationItem = { id: 'feedback', label: 'Feedback', icon: MessageSquare };

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
          onClick={onMobileMenuToggle}
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <Menu className="w-6 h-6 text-gray-600" />
        </button>
      </header>

      {/* Mobile Navigation Drawer */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={onMobileMenuClose}
          />
          
          {/* Drawer */}
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <LayoutDashboard className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Visão Clara</h2>
              </div>
              <button 
                onClick={onMobileMenuClose}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            
            {/* Project Dropdown */}
            <div className="p-4 border-b border-gray-200">
              <ProjectDropdown
                onProjectSelect={setActiveProjectId}
              />
            </div>
            
            {/* Drawer Navigation */}
            <nav className="p-4 flex flex-col flex-1 overflow-y-auto">
              <div className="flex-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'expenses') {
                          const expensesUrl = getExpensesUrl();
                          if (expensesUrl) {
                            router.push(expensesUrl);
                          }
                        } else if (item.id === 'documents') {
                          const documentsUrl = getDocumentsUrl();
                          if (documentsUrl) {
                            router.push(documentsUrl);
                          }
                        } else if (item.id === 'checklist') {
                          const checklistUrl = getChecklistUrl();
                          if (checklistUrl) {
                            router.push(checklistUrl);
                          }
                        } else if (item.id === 'responsaveis') {
                          const responsaveisUrl = getResponsaveisUrl();
                          if (responsaveisUrl) {
                            router.push(responsaveisUrl);
                          }
                        } else if (item.id === 'export') {
                          const exportUrl = getExportUrl();
                          if (exportUrl) {
                            router.push(exportUrl);
                          }
                        } else {
                          router.push(`/${item.id === 'dashboard' ? '' : item.id}`);
                        }
                        onMobileMenuClose?.();
                      }}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                        currentPage === item.id
                          ? 'bg-blue-50 text-blue-600'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Feedback at bottom */}
              <div className="border-t border-gray-200 pt-2 mt-2 pb-4">
                {(() => {
                  const Icon = feedbackNavigationItem.icon;
                  return (
                    <button
                      onClick={() => {
                        const feedbackUrl = getFeedbackUrl();
                        if (feedbackUrl) {
                          router.push(feedbackUrl);
                        }
                        onMobileMenuClose?.();
                      }}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                        currentPage === feedbackNavigationItem.id
                          ? 'bg-blue-50 text-blue-600'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{feedbackNavigationItem.label}</span>
                    </button>
                  );
                })()}
              </div>

              {/* User Section */}
              <div className="border-t border-gray-200 pt-2 mt-2 pb-4">
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {userData.initials}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-gray-900">{userData.name}</p>
                      <p className="text-xs text-gray-500 truncate">{userData.email}</p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`} />
                  </button>

                  {/* User Menu Dropdown */}
                  {isUserMenuOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                      <button
                        onClick={() => {
                          router.push('/profile');
                          setIsUserMenuOpen(false);
                          onMobileMenuClose?.();
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <User className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">Meu Perfil</span>
                      </button>
                      <button
                        onClick={() => {
                          console.log('Logout clicked');
                          setIsUserMenuOpen(false);
                          onMobileMenuClose?.();
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors border-t border-gray-100"
                      >
                        <LogOut className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-900">Sair</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-white shadow-md hidden md:block min-h-screen">
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center space-x-2 mb-8">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Visão Clara</h2>
            </div>
            
            {/* Project Dropdown */}
            <div className="mb-6">
              <ProjectDropdown
                onProjectSelect={setActiveProjectId}
              />
            </div>
            
            <nav className="space-y-2 flex-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'expenses') {
                        const expensesUrl = getExpensesUrl();
                        if (expensesUrl) {
                          router.push(expensesUrl);
                        }
                      } else if (item.id === 'documents') {
                        const documentsUrl = getDocumentsUrl();
                        if (documentsUrl) {
                          router.push(documentsUrl);
                        }
                      } else if (item.id === 'checklist') {
                        const checklistUrl = getChecklistUrl();
                        if (checklistUrl) {
                          router.push(checklistUrl);
                        }
                      } else if (item.id === 'responsaveis') {
                        const responsaveisUrl = getResponsaveisUrl();
                        if (responsaveisUrl) {
                          router.push(responsaveisUrl);
                        }
                      } else if (item.id === 'export') {
                        const exportUrl = getExportUrl();
                        if (exportUrl) {
                          router.push(exportUrl);
                        }
                      } else if (item.id === 'dashboard') {
                        router.push('/dashboard');
                      } else {
                        router.push(`/${item.id}`);
                      }
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      currentPage === item.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            
            {/* Feedback at bottom */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              {(() => {
                const Icon = feedbackNavigationItem.icon;
                return (
                  <button
                    onClick={() => {
                      const feedbackUrl = getFeedbackUrl();
                      if (feedbackUrl) {
                        router.push(feedbackUrl);
                      }
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                      currentPage === feedbackNavigationItem.id
                        ? 'bg-blue-50 text-blue-600'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{feedbackNavigationItem.label}</span>
                  </button>
                );
              })()}
            </div>

            {/* User Section */}
            <div className="border-t border-gray-200 pt-4 mt-4">
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {userData.initials}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900">{userData.name}</p>
                    <p className="text-xs text-gray-500 truncate">{userData.email}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                    isUserMenuOpen ? 'rotate-180' : ''
                  }`} />
                </button>

                {/* User Menu Dropdown */}
                {isUserMenuOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <button
                      onClick={() => {
                        router.push('/profile');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">Meu Perfil</span>
                    </button>
                    <button
                      onClick={() => {
                        console.log('Logout clicked');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors border-t border-gray-100"
                    >
                      <LogOut className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">Sair</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 pt-20 md:pt-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden">
        <div className="grid grid-cols-4 py-2">
          {bottomNavigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'expenses') {
                    const expensesUrl = getExpensesUrl();
                    if (expensesUrl) {
                      router.push(expensesUrl);
                    }
                  } else if (item.id === 'documents') {
                    const documentsUrl = getDocumentsUrl();
                    if (documentsUrl) {
                      router.push(documentsUrl);
                    }
                  } else if (item.id === 'checklist') {
                    const checklistUrl = getChecklistUrl();
                    if (checklistUrl) {
                      router.push(checklistUrl);
                    }
                  } else if (item.id === 'responsaveis') {
                    const responsaveisUrl = getResponsaveisUrl();
                    if (responsaveisUrl) {
                      router.push(responsaveisUrl);
                    }
                  } else if (item.id === 'export') {
                    const exportUrl = getExportUrl();
                    if (exportUrl) {
                      router.push(exportUrl);
                    }
                  } else if (item.id === 'dashboard') {
                    router.push('/dashboard');
                  } else {
                    router.push(`/${item.id}`);
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
