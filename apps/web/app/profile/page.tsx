'use client';

import { Suspense, useState, useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Camera, Check, CreditCard, Settings, Shield, X, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import AppLayout from '@/components/AppLayout';
import { type UserProfile, PlanId, type BillingPeriod } from '@/src/mocks';
import { useProjectStore } from '@/src/store/projectStore';
import { supabase } from '@/lib/supabase/client';
import { ProfileService } from '@/src/services/profileService';

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
  /** Shown below `lg`, where the content area is too narrow for the full labels */
  shortLabel: string;
  icon: LucideIcon;
}

const tabs: TabItem[] = [
  { id: 'account', label: 'Configurações da Conta', shortLabel: 'Conta', icon: Settings },
  { id: 'plans', label: 'Planos & Faturação', shortLabel: 'Planos', icon: CreditCard },
  { id: 'privacy', label: 'Privacidade & Dados', shortLabel: 'Privacidade', icon: Shield },
];

// Display formatting only (pt-PT, EUR); the prices themselves come from `pricingPlans`
const eurFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const eurWholeFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// Pricing plans data
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

function ProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const getInitialTab = (): TabType => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['account', 'plans', 'privacy'].includes(tabParam)) {
      return tabParam as TabType;
    }
    return 'account';
  };
  
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  
  // Use store for user profile data and subscription
  const userProfile = useProjectStore((state) => state.userProfile);
  const billing = useProjectStore((state) => state.billing);
  const updateUserProfile = useProjectStore((state) => state.updateUserProfile);
  const setUserProfile = useProjectStore((state) => state.setUserProfile);
  const setBillingPeriod = useProjectStore((state) => state.setBillingPeriod);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Extract subscription data from billing store
  const currentPlanId = billing.subscription.planId;
  const billingPeriod = billing.subscription.billingPeriod;
  
  const handleTabChange = (tabId: TabType) => {
    setActiveTab(tabId);
    // Update URL without full page reload
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabId);
    router.replace(url.toString());
  };
  
  // Sync tab state with URL changes
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['account', 'plans', 'privacy'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);
  
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

  // Load profile from backend on mount
  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoadError('Utilizador não autenticado');
          setIsLoading(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone, city, country, avatar_url, plan')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          setLoadError('Erro ao carregar perfil');
          console.error('Error loading profile:', error);
        }

        const loadedProfile: UserProfile = {
          id: user.id,
          firstName: profile?.first_name || '',
          lastName: profile?.last_name || '',
          email: user.email || '',
          phone: profile?.phone || '',
          city: profile?.city || '',
          country: profile?.country || '',
          avatarInitials: getInitials(profile?.first_name, profile?.last_name),
          plan: (profile?.plan as PlanId) || 'free',
        };

        setUserProfile(loadedProfile);

        // Sync plan from backend to store billing
        if (profile?.plan) {
          ProfileService.syncPlanFromProfile({ id: user.id, plan: profile.plan });
        }
      } catch (err) {
        setLoadError('Erro ao carregar perfil');
        console.error('Failed to load profile:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [setUserProfile]);

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
    // A new edit makes the previous "saved" confirmation stale
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSaveError('Utilizador não autenticado');
        setIsSaving(false);
        return;
      }

      const fullName = `${formData.firstName} ${formData.lastName}`.trim();

      const { data: profile, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: fullName || null,
          phone: formData.phone || null,
          city: formData.city || null,
          country: formData.country || null,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        setSaveError('Erro ao guardar perfil. Tente novamente.');
        console.error('Error saving profile:', error);
        setIsSaving(false);
        return;
      }

      if (profile) {
        setUserProfile({
          id: user.id,
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          email: user.email || '',
          phone: profile.phone || '',
          city: profile.city || '',
          country: profile.country || '',
          avatarInitials: getInitials(profile.first_name, profile.last_name),
          plan: (profile.plan as PlanId) || 'free',
        });
      }

      setSaveSuccess(true);
    } catch (err) {
      setSaveError('Erro ao guardar perfil. Tente novamente.');
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Photo upload is not implemented yet: show an inline notice instead of a native alert
  const [showAvatarNotice, setShowAvatarNotice] = useState(false);
  const handleAvatarChange = () => {
    setShowAvatarNotice(true);
  };

  // Tabs: WAI-ARIA tab pattern (roving tabindex, arrow/Home/End keys)
  const tabRefs = useRef<Record<TabType, HTMLButtonElement | null>>({ account: null, plans: null, privacy: null });
  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') nextIndex = 0;
    else if (e.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const nextTab = tabs[nextIndex].id;
    handleTabChange(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  // Pricing helper functions (display only; values come from `pricingPlans`)
  const getDisplayPrice = (plan: PricingPlan) => {
    return billingPeriod === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
  };

  const getAnnualBillingNote = (plan: PricingPlan) => {
    if (plan.id === 'free' || billingPeriod === 'monthly') return null;

    const annualTotal = plan.annualPrice * 12;
    return `Faturado anualmente (${eurWholeFormatter.format(Math.round(annualTotal))}/ano)`;
  };

  const renderTabPanel = (tabId: TabType, content: React.ReactNode, className?: string) => (
    <div
      role="tabpanel"
      id={`profile-panel-${tabId}`}
      aria-labelledby={`profile-tab-${tabId}`}
      tabIndex={0}
      className={cn('rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2', className)}
    >
      {content}
    </div>
  );

  return (
    <AppLayout
      currentPage="profile"
      showMobileMenu={isMobileMenuOpen}
      onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      onMobileMenuClose={() => setIsMobileMenuOpen(false)}
    >
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerir as suas definições de conta, preferências e dados pessoais.
          </p>
        </div>

        {/* Tabs (Figma: pill tabs above a divider; short labels below lg because of the sidebar width) */}
        <div className="mb-6 overflow-x-auto border-b border-gray-200 pb-4">
          <div role="tablist" aria-label="Secções do perfil" className="flex w-full gap-1 sm:w-auto">
            {tabs.map((tab, index) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  type="button"
                  role="tab"
                  id={`profile-tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`profile-panel-${tab.id}`}
                  aria-label={tab.label}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleTabChange(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  className={cn(
                    'inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:flex-none sm:gap-2 sm:px-4 sm:text-sm',
                    isActive
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <TabIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="hidden lg:inline">{tab.label}</span>
                  <span className="lg:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'account' && renderTabPanel('account', (
          <Card>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900">Informações do Perfil</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Gerir os seus dados pessoais e informações de contacto.
                </p>
              </div>
              {isLoading && (
                <span className="inline-flex items-center gap-2 text-sm text-gray-500">
                  <Spinner size="sm" label={null} />
                  A carregar perfil...
                </span>
              )}
            </div>

            {loadError && (
              <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{loadError}</p>
              </div>
            )}

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-6"
            >
              {/* Avatar Section */}
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6 sm:gap-6">
                <div className="relative shrink-0">
                  <div
                    aria-hidden="true"
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-medium text-white sm:h-24 sm:w-24"
                  >
                    {userData.initials}
                  </div>
                  <button
                    type="button"
                    onClick={handleAvatarChange}
                    aria-label="Alterar foto do perfil"
                    className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-blue-600 p-2 text-white shadow-lg outline-none transition-colors hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="min-w-0">
                  <p className="break-words text-lg font-semibold text-gray-900">{userData.name.trim() || 'Utilizador'}</p>
                  <p className="mt-1 text-sm text-gray-500 wrap-anywhere">{userData.email}</p>
                  <button
                    type="button"
                    onClick={handleAvatarChange}
                    className="mt-2 cursor-pointer rounded text-sm font-medium text-blue-600 outline-none hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Alterar foto
                  </button>
                  {showAvatarNotice && (
                    <p role="status" className="mt-1 text-xs text-gray-500">
                      A alteração de foto estará disponível em breve.
                    </p>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">Primeiro Nome</Label>
                  <Input
                    type="text"
                    id="firstName"
                    autoComplete="given-name"
                    value={formData.firstName}
                    onChange={handleInputChange('firstName')}
                  />
                </div>

                <div>
                  <Label htmlFor="lastName">Apelido</Label>
                  <Input
                    type="text"
                    id="lastName"
                    autoComplete="family-name"
                    value={formData.lastName}
                    onChange={handleInputChange('lastName')}
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  {/* Read-only: the save handler does not persist email (auth email change is not implemented) */}
                  <Input
                    type="email"
                    id="email"
                    autoComplete="email"
                    value={formData.email}
                    readOnly
                    aria-describedby="email-help"
                    className="cursor-default text-gray-600"
                  />
                  <p id="email-help" className="mt-1.5 text-xs text-gray-500">
                    De momento não é possível alterar o email da conta.
                  </p>
                </div>

                <div>
                  <Label htmlFor="phone">Telemóvel</Label>
                  <Input
                    type="tel"
                    id="phone"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handleInputChange('phone')}
                  />
                </div>

                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    type="text"
                    id="city"
                    autoComplete="address-level2"
                    value={formData.city}
                    onChange={handleInputChange('city')}
                  />
                </div>

                <div>
                  <Label htmlFor="country">País</Label>
                  <Input
                    type="text"
                    id="country"
                    autoComplete="country-name"
                    value={formData.country}
                    onChange={handleInputChange('country')}
                  />
                </div>
              </div>

              {saveError && (
                <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{saveError}</p>
                </div>
              )}
              {saveSuccess && (
                <div role="status" className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">
                  <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <p className="text-sm font-medium">Perfil atualizado com sucesso!</p>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button type="submit" size="sm" loading={isSaving} className="h-10 w-full sm:w-auto">
                  {isSaving ? 'A guardar...' : 'Guardar Alterações'}
                </Button>
              </div>
            </form>
          </Card>
        ))}

        {activeTab === 'plans' && renderTabPanel('plans', (
          <>
            {/* Header */}
            <div className="space-y-4 text-center">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Planos & Preços</h2>
              <p className="mx-auto max-w-2xl text-sm text-gray-600 sm:text-base">
                Escolha o plano ideal para gerir os seus projetos de construção com eficiência e profissionalismo
              </p>

              {/* Billing Toggle */}
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="flex items-center justify-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn('text-sm font-medium transition-colors', billingPeriod === 'monthly' ? 'text-gray-900' : 'text-gray-500')}
                  >
                    Mensal
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={billingPeriod === 'yearly'}
                    aria-label="Faturação anual"
                    onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
                    className={cn(
                      'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      billingPeriod === 'yearly' ? 'bg-blue-600' : 'bg-gray-300'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                        billingPeriod === 'yearly' ? 'translate-x-5.5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                  <span
                    aria-hidden="true"
                    className={cn('text-sm font-medium transition-colors', billingPeriod === 'yearly' ? 'text-gray-900' : 'text-gray-500')}
                  >
                    Anual
                  </span>
                </div>
                <Badge variant="success" className="border-green-200 text-green-700">
                  Poupe 20% com faturação anual
                </Badge>
              </div>
            </div>

            {/* Pricing Cards: one column until the content area fits three readable cards */}
            <div className="mt-10 grid grid-cols-1 gap-8 xl:grid-cols-3 xl:gap-6">
              {pricingPlans.map((plan) => {
                const price = getDisplayPrice(plan);
                const annualNote = getAnnualBillingNote(plan);
                const isCurrentPlan = plan.id === currentPlanId;

                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      'relative mx-auto flex w-full max-w-xl flex-col p-0',
                      plan.popular && 'border-blue-500 shadow-lg',
                      isCurrentPlan && !plan.popular && 'border-gray-400',
                      plan.comingSoon && 'opacity-75'
                    )}
                  >
                    {plan.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className={plan.popular ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'}>
                          {plan.badge}
                        </Badge>
                      </div>
                    )}

                    <div className="px-6 pb-6 pt-8 text-center">
                      <h3 className="text-2xl font-semibold text-gray-900">{plan.name}</h3>
                      <p className="mt-2 text-sm text-gray-500 xl:min-h-10">{plan.description}</p>
                      {/* Row reserved on every card in the 3-column layout so prices stay aligned */}
                      <div className={cn('justify-center', isCurrentPlan ? 'mt-3 flex' : 'hidden xl:mt-3 xl:flex xl:h-[22px]')}>
                        {isCurrentPlan && (
                          <Badge variant="info">
                            <Check aria-hidden="true" />
                            Plano atual
                          </Badge>
                        )}
                      </div>

                      {/* Price */}
                      <div className="pt-6">
                        {plan.id === 'free' ? (
                          <p className="text-4xl font-bold text-gray-900">Grátis</p>
                        ) : (
                          <>
                            <p className="flex flex-wrap items-baseline justify-center gap-1">
                              <span className="text-4xl font-bold text-gray-900">{eurFormatter.format(price)}</span>
                              <span className="text-gray-500">/mês</span>
                            </p>
                            {annualNote && <p className="mt-2 text-xs text-gray-500">{annualNote}</p>}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-6 px-6 pb-6">
                      {/* Features */}
                      <ul className="flex-1 space-y-3">
                        {plan.features.included.map((feature) => (
                          <li key={feature} className="flex items-start gap-3">
                            <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
                            <span className="text-sm text-gray-700">{feature}</span>
                          </li>
                        ))}
                        {plan.features.notIncluded.map((feature) => (
                          <li key={feature} className="flex items-start gap-3">
                            <X className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" aria-hidden="true" />
                            <span className="text-sm text-gray-400">
                              <span className="sr-only">Não incluído: </span>
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* Plans are assigned manually during the beta; no self-service changes */}
                      <Button variant="outline" size="sm" disabled className="h-10 w-full">
                        {isCurrentPlan ? 'Plano Atual' :
                         plan.comingSoon ? 'Em Desenvolvimento' :
                         'Indisponível'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Bottom Info Banner */}
            <Card className="mt-10 border-blue-200 bg-blue-50">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
                  <CreditCard className="h-5 w-5 text-blue-600" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="mb-1 font-semibold text-blue-900">Planos pagos em breve</h3>
                  <p className="text-sm text-blue-700">
                    Os planos pagos ainda não estão disponíveis. Contacte-nos para mais informações.
                  </p>
                </div>
              </div>
            </Card>
          </>
        ))}

        {activeTab === 'privacy' && renderTabPanel('privacy', (
          <Card>
            <h2 className="text-lg font-semibold text-gray-900">Privacidade & Dados</h2>
            <p className="mt-1 text-sm text-gray-500">
              Gerir as suas preferências de privacidade e dados pessoais.
            </p>
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <Shield className="h-8 w-8 text-gray-400" aria-hidden="true" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">Em breve</h3>
              <p className="mx-auto max-w-md text-sm text-gray-500">
                As definições de privacidade e gestão de dados estarão disponíveis em breve.
              </p>
            </div>
          </Card>
        ))}
      </div>

    </AppLayout>
  );
}

// useSearchParams() requires a Suspense boundary for the production build
export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}
