'use client';

import { useState, useEffect, useMemo } from 'react';
import { HiCamera, HiUser, HiCreditCard, HiShieldCheck, HiCheck, HiXMark, HiSparkles  } from 'react-icons/hi2';
import { Card } from '@/components/ui/Card';
import AppLayout from '@/components/AppLayout';
import { type UserProfile } from '@/src/mocks';
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

// Pricing plans data
type BillingPeriod = 'monthly' | 'annual';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: {
    included: string[];
    notIncluded: string[];
  };
  badge?: string;
  popular?: boolean;
  comingSoon?: boolean;
}

const pricingPlans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Gratuito',
    description: 'Perfeito para pequenos projetos',
    monthlyPrice: 0,
    annualPrice: 0,
    features: {
      included: [
        '1 projeto',
        'Checklist manual',
        'Dashboard básico',
        'Até 5–10 documentos',
        'Até 3–5 responsáveis da obra',
        '1–2 gerações de tarefas IA por mês',
        'Chat IA limitado'
      ],
      notIncluded: [
        'Projetos ilimitados',
        'Documentos ilimitados',
        'Exportar relatórios'
      ]
    }
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Ideal para profissionais e empresas',
    monthlyPrice: 12.99,
    annualPrice: 10.00,
    features: {
      included: [
        'Projetos ilimitados',
        'Checklist completo',
        'Até 30 documentos com uploads',
        'Responsáveis ilimitados',
        'Exportar relatórios',
        'Sugestões de tarefas IA ilimitadas',
        'Chat IA ilimitado',
        'Sugestões baseadas em fase e tipo'
      ],
      notIncluded: [
        'Análise financeira avançada',
        'Deteção de riscos'
      ]
    },
    badge: 'Mais Popular',
    popular: true
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Recursos avançados para grandes empresas',
    monthlyPrice: 19.99,
    annualPrice: 16.00,
    features: {
      included: [
        'Tudo do Pro',
        'Insights avançados com IA',
        'Análise financeira',
        'Deteção de riscos',
        'Comparação de projetos',
        'Resumos automáticos',
        'Suporte prioritário'
      ],
      notIncluded: []
    },
    badge: 'Em Breve',
    comingSoon: true
  }
];

export default function ProfilePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  
  // Use store for user profile data
  const userProfile = useProjectStore((state) => state.userProfile);
  const updateUserProfile = useProjectStore((state) => state.updateUserProfile);
  
  // Derive initials dynamically from store values
  const initials = useMemo(() => 
    getInitials(userProfile.firstName, userProfile.lastName), 
    [userProfile.firstName, userProfile.lastName]
  );
  
  // Initialize form data from store
  const [formData, setFormData] = useState({
    firstName: userProfile.firstName,
    lastName: userProfile.lastName,
    email: userProfile.email,
    phone: userProfile.phone,
    city: userProfile.city || '',
    country: userProfile.country || ''
  });

  // Update form when store data changes
  useEffect(() => {
    setFormData({
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      email: userProfile.email,
      phone: userProfile.phone,
      city: userProfile.city || '',
      country: userProfile.country || ''
    });
  }, [userProfile]);

  const userData = {
    name: `${userProfile.firstName} ${userProfile.lastName}`,
    email: userProfile.email,
    initials // Use dynamic initials instead of hardcoded
  };

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleSave = () => {
    // Update store with form data
    updateUserProfile({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      city: formData.city || undefined,
      country: formData.country || undefined
    });
    
    console.log('Perfil atualizado:', formData);
    alert('Perfil atualizado com sucesso!');
  };

  const handleAvatarChange = () => {
    console.log('Avatar change clicked');
    alert('Funcionalidade de alterar foto em breve!');
  };

  // Pricing helper functions
  const getDisplayPrice = (plan: PricingPlan) => {
    if (plan.id === 'free') return { price: 0, billing: 'Grátis' };
    
    const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
    const billing = billingPeriod === 'monthly' ? '/mês' : '/mês';
    
    return { price, billing };
  };

  const getAnnualBillingNote = (plan: PricingPlan) => {
    if (plan.id === 'free' || billingPeriod === 'monthly') return null;
    
    const annualTotal = plan.annualPrice * 12;
    return `Faturado anualmente (€${annualTotal.toFixed(0)}/ano)`;
  };

  const handleUpgrade = (planId: string) => {
    console.log('Upgrade clicked for plan:', planId);
    alert('Em breve');
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
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Planos & Preços</h2>
                <p className="text-gray-600 text-base max-w-2xl mx-auto">
                  Escolha o plano ideal para gerir os seus projetos de construção com eficiência e profissionalismo
                </p>
              </div>

              {/* Billing Toggle */}
              <div className="flex flex-col items-center mb-8">
                <div className="flex items-center space-x-4 mb-3">
                  <span className={`text-sm font-medium ${
                    billingPeriod === 'monthly' ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    Mensal
                  </span>
                  <button
                    onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'annual' : 'monthly')}
                    className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        billingPeriod === 'annual' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`text-sm font-medium ${
                    billingPeriod === 'annual' ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    Anual
                  </span>
                </div>
                {billingPeriod === 'annual' && (
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                    Poupe 20% com faturação anual
                  </div>
                )}
              </div>

              {/* Pricing Cards - Desktop */}
              <div className="hidden md:grid grid-cols-3 gap-6 mb-8">
                {pricingPlans.map((plan) => {
                  const { price, billing } = getDisplayPrice(plan);
                  const annualNote = getAnnualBillingNote(plan);
                  
                  return (
                    <div
                      key={plan.id}
                      className={`relative bg-white rounded-lg border-2 ${
                        plan.popular
                          ? 'border-blue-500 shadow-lg'
                          : plan.comingSoon
                          ? 'border-gray-200 opacity-75'
                          : 'border-gray-200'
                      }`}
                    >
                      {/* Badge */}
                      {plan.badge && (
                        <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium ${
                          plan.popular
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {plan.badge}
                        </div>
                      )}

                      <div className="p-6">
                        {/* Plan Name */}
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-gray-600 text-center mb-6">
                          {plan.description}
                        </p>

                        {/* Price */}
                        <div className="text-center mb-6">
                          {plan.id === 'free' ? (
                            <div className="text-3xl font-bold text-gray-900">Grátis</div>
                          ) : (
                            <>
                              <div className="text-3xl font-bold text-gray-900">
                                €{price.toFixed(2)}
                                <span className="text-lg font-normal text-gray-600">{billing}</span>
                              </div>
                              {annualNote && (
                                <div className="text-sm text-gray-500 mt-1">{annualNote}</div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Features */}
                        <div className="space-y-3 mb-6">
                          {plan.features.included.map((feature, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <HiCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                              <span className="text-sm text-gray-700">{feature}</span>
                            </div>
                          ))}
                          {plan.features.notIncluded.map((feature, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <HiXMark className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-500">{feature}</span>
                            </div>
                          ))}
                        </div>

                        {/* Button */}
                        <button
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={plan.id === 'free' || plan.comingSoon}
                          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                            plan.id === 'free'
                              ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                              : plan.comingSoon
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : plan.popular
                              ? 'bg-black text-white hover:bg-gray-800'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {plan.id === 'free' ? 'Plano Atual' : 
                           plan.comingSoon ? 'Em Desenvolvimento' : 
                           'Fazer Upgrade'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pricing Cards - Mobile */}
              <div className="md:hidden space-y-6 mb-8">
                {pricingPlans.map((plan) => {
                  const { price, billing } = getDisplayPrice(plan);
                  const annualNote = getAnnualBillingNote(plan);
                  
                  return (
                    <div
                      key={plan.id}
                      className={`relative bg-white rounded-lg border-2 ${
                        plan.popular
                          ? 'border-blue-500 shadow-lg'
                          : plan.comingSoon
                          ? 'border-gray-200 opacity-75'
                          : 'border-gray-200'
                      }`}
                    >
                      {/* Badge */}
                      {plan.badge && (
                        <div className={`absolute -top-3 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium ${
                          plan.popular
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {plan.badge}
                        </div>
                      )}

                      <div className="p-6">
                        {/* Plan Name */}
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-gray-600 text-center mb-6">
                          {plan.description}
                        </p>

                        {/* Price */}
                        <div className="text-center mb-6">
                          {plan.id === 'free' ? (
                            <div className="text-3xl font-bold text-gray-900">Grátis</div>
                          ) : (
                            <>
                              <div className="text-3xl font-bold text-gray-900">
                                €{price.toFixed(2)}
                                <span className="text-lg font-normal text-gray-600">{billing}</span>
                              </div>
                              {annualNote && (
                                <div className="text-sm text-gray-500 mt-1">{annualNote}</div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Features */}
                        <div className="space-y-3 mb-6">
                          {plan.features.included.map((feature, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <HiCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                              <span className="text-sm text-gray-700">{feature}</span>
                            </div>
                          ))}
                          {plan.features.notIncluded.map((feature, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <HiXMark className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-500">{feature}</span>
                            </div>
                          ))}
                        </div>

                        {/* Button */}
                        <button
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={plan.id === 'free' || plan.comingSoon}
                          className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                            plan.id === 'free'
                              ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
                              : plan.comingSoon
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : plan.popular
                              ? 'bg-black text-white hover:bg-gray-800'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {plan.id === 'free' ? 'Plano Atual' : 
                           plan.comingSoon ? 'Em Desenvolvimento' : 
                           'Fazer Upgrade'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Info Banner */}
              <Card className="bg-blue-50 border-blue-200">
                <div className="flex items-start space-x-3">
                  <HiSparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Pagamento seguro e flexível
                    </h4>
                    <p className="text-sm text-gray-700">
                      Todos os planos incluem período de teste gratuito de 14 dias. Cancele a qualquer momento sem compromisso. Aceitamos cartões de crédito, débito e transferência bancária.
                    </p>
                  </div>
                </div>
              </Card>
            </>
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
