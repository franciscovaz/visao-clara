'use client';

import { useState } from 'react';
import { HiCamera, HiUser, HiCreditCard, HiShieldCheck } from 'react-icons/hi2';
import { Card } from '@/components/ui/Card';
import AppLayout from '@/components/AppLayout';
import { mockUserProfile, type UserProfile } from '@/src/mocks';

type TabType = 'account' | 'plans' | 'privacy';

interface TabItem {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabItem[] = [
  {
    id: 'account',
    label: 'Configurações da Conta',
    icon: <HiUser className="w-4 h-4" />
  },
  {
    id: 'plans',
    label: 'Planos & Faturação',
    icon: <HiCreditCard className="w-4 h-4" />
  },
  {
    id: 'privacy',
    label: 'Privacidade & Dados',
    icon: <HiShieldCheck className="w-4 h-4" />
  }
];

export default function ProfilePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('account');
  
  // Use mock user profile data
  const [formData, setFormData] = useState({
    firstName: mockUserProfile.firstName,
    lastName: mockUserProfile.lastName,
    email: mockUserProfile.email,
    phone: mockUserProfile.phone,
    city: mockUserProfile.city || '',
    country: mockUserProfile.country || ''
  });

  const userData = {
    name: `${mockUserProfile.firstName} ${mockUserProfile.lastName}`,
    email: mockUserProfile.email,
    initials: mockUserProfile.avatarInitials
  };

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleSave = () => {
    console.log('Profile data saved:', formData);
    alert('Alterações guardadas com sucesso!');
  };

  const handleAvatarChange = () => {
    console.log('Avatar change clicked');
    alert('Funcionalidade de alterar foto em breve!');
  };

  return (
    <AppLayout 
      currentPage="profile"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Meu Perfil</h1>
          <p className="text-gray-600 text-base">
            Gerir as suas definições de conta, preferências e dados pessoais.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          {/* Mobile Tabs - Pill Style */}
          <div className="md:hidden">
            <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">
                    {tab.id === 'account' ? 'Conta' : 
                     tab.id === 'plans' ? 'Planos' : 'Privacidade'}
                  </span>
                </button>
              ))}
            </div>
            <div className="border-b border-gray-200"></div>
          </div>

          {/* Desktop Tabs - Original Style */}
          <div className="hidden md:block border-b border-gray-200">
            <nav className="flex space-x-8 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'account' && (
            <>
              {/* Profile Header */}
              <Card className="p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Informações do Perfil</h2>
                  <p className="text-gray-600 text-sm">
                    Gerir os seus dados pessoais e informações de contacto.
                  </p>
                </div>

                {/* Avatar Section */}
                <div className="flex items-center space-x-4 mb-6">
                  <div className="relative">
                    <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-medium">
                      {userData.initials}
                    </div>
                    <button
                      onClick={handleAvatarChange}
                      className="absolute bottom-0 right-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition-colors"
                    >
                      <HiCamera className="w-3 h-3" />
                    </button>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{userData.name}</p>
                    <p className="text-sm text-gray-500">{userData.email}</p>
                    <button
                      onClick={handleAvatarChange}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1"
                    >
                      Alterar foto
                    </button>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                      Primeiro Nome
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange('firstName')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                      Apelido
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange('lastName')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={handleInputChange('email')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Telemóvel
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={formData.phone}
                      onChange={handleInputChange('phone')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                      Cidade
                    </label>
                    <input
                      type="text"
                      id="city"
                      value={formData.city}
                      onChange={handleInputChange('city')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                      País
                    </label>
                    <input
                      type="text"
                      id="country"
                      value={formData.country}
                      onChange={handleInputChange('country')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <div className="mt-8">
                  <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Guardar Alterações
                  </button>
                </div>
              </Card>
            </>
          )}

          {activeTab === 'plans' && (
            <Card className="p-8 text-center">
              <HiCreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Planos & Faturação</h3>
              <p className="text-gray-600 mb-4">
                Gestão de planos e faturação em breve.
              </p>
              <p className="text-sm text-gray-500">
                Esta funcionalidade estará disponível em breve.
              </p>
            </Card>
          )}

          {activeTab === 'privacy' && (
            <Card className="p-8 text-center">
              <HiShieldCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Privacidade & Dados</h3>
              <p className="text-gray-600 mb-4">
                Configurações de privacidade e gestão de dados em breve.
              </p>
              <p className="text-sm text-gray-500">
                Esta funcionalidade estará disponível em breve.
              </p>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
