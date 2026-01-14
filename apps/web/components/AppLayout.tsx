'use client';

import { useRouter } from 'next/navigation';
import { HiHome, HiCheckCircle, HiDocument, HiCurrencyDollar, HiDownload, HiMenu, HiX } from 'react-icons/hi';

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

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HiHome },
    { id: 'checklist', label: 'Checklist', icon: HiCheckCircle },
    { id: 'documents', label: 'Documentos', icon: HiDocument },
    { id: 'expenses', label: 'Despesas', icon: HiCurrencyDollar },
    { id: 'export', label: 'Exportar', icon: HiDownload },
  ];

  const bottomNavigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HiHome },
    { id: 'checklist', label: 'Checklist', icon: HiCheckCircle },
    { id: 'documents', label: 'Documentos', icon: HiDocument },
    { id: 'expenses', label: 'Despesas', icon: HiCurrencyDollar },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between p-4 bg-white shadow-sm md:hidden">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <HiHome className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Visão Clara</h1>
        </div>
        <button 
          onClick={onMobileMenuToggle}
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <HiMenu className="w-6 h-6 text-gray-600" />
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
                  <HiHome className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Visão Clara</h2>
              </div>
              <button 
                onClick={onMobileMenuClose}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <HiX className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            
            {/* Drawer Navigation */}
            <nav className="p-4">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      router.push(`/${item.id === 'dashboard' ? '' : item.id}`);
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
            </nav>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-white shadow-md hidden md:block min-h-screen">
          <div className="p-6">
            <div className="flex items-center space-x-2 mb-8">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <HiHome className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Visão Clara</h2>
            </div>
            <nav className="space-y-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'dashboard') {
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
                  if (item.id === 'dashboard') {
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
