import {
  BarChart3,
  Brain,
  Building2,
  CheckSquare,
  Clock,
  FileCheck,
  FileText,
  Shield,
  Target,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Existing app routes used by the landing page CTAs. */
export const LANDING_ROUTES = {
  login: '/login',
  start: '/onboarding/step1',
  privacy: '/privacidade',
  terms: '/termos',
} as const;

/** In-page anchors (pt-PT, visible in the URL). */
export const LANDING_ANCHORS = {
  features: 'funcionalidades',
  howItWorks: 'como-funciona',
  pricing: 'precos',
} as const;

export const NAV_LINKS = [
  { href: `#${LANDING_ANCHORS.features}`, label: 'Funcionalidades' },
  { href: `#${LANDING_ANCHORS.howItWorks}`, label: 'Como funciona' },
  { href: `#${LANDING_ANCHORS.pricing}`, label: 'Preços' },
];

interface IconItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const PROBLEMS: IconItem[] = [
  {
    icon: FileText,
    title: 'Informação espalhada',
    description: 'Documentos em várias pastas, conversas perdidas no WhatsApp',
  },
  {
    icon: TrendingUp,
    title: 'Controlo de custos fraco',
    description: 'Despesas não registadas, orçamento difícil de gerir',
  },
  {
    icon: Clock,
    title: 'Stress constante',
    description: 'Ansiedade em gerir renovações ou construções',
  },
];

export const SOLUTIONS: IconItem[] = [
  {
    icon: Target,
    title: 'Centralização total',
    description: 'Todos os projetos, documentos e despesas num único local',
  },
  {
    icon: Shield,
    title: 'Simplicidade',
    description: 'Uma interface simples, pensada para quem não é especialista em gestão de obras',
  },
  {
    icon: Zap,
    title: 'Visibilidade completa',
    description: 'Acompanhe o progresso, as despesas e as próximas tarefas de cada projeto',
  },
];

export const BENEFITS: IconItem[] = [
  {
    icon: BarChart3,
    title: 'Controlo financeiro',
    description: 'Veja exatamente onde está a gastar e compare com o orçamento previsto',
  },
  {
    icon: CheckSquare,
    title: 'Visibilidade do projeto',
    description: 'Acompanhe cada etapa e garanta que nada fica esquecido',
  },
  {
    icon: Users,
    title: 'Menos stress',
    description: 'Tenha toda a informação organizada e acessível em qualquer momento',
  },
  {
    icon: Target,
    title: 'Decisões mais informadas',
    description: 'Dados claros para tomar as melhores decisões no seu projeto',
  },
];

export const HOW_IT_WORKS: (IconItem & { step: string })[] = [
  {
    step: '1',
    icon: Building2,
    title: 'Crie o seu projeto',
    description: 'Defina o tipo de obra, a fase atual e o orçamento inicial em poucos minutos',
  },
  {
    step: '2',
    icon: FileCheck,
    title: 'Registe tudo num só lugar',
    description: 'Adicione despesas, documentos, responsáveis e as próximas tarefas',
  },
  {
    step: '3',
    icon: TrendingUp,
    title: 'Acompanhe o progresso',
    description: 'Consulte o dashboard do projeto e mantenha tudo sob controlo',
  },
];

export const FEATURES: IconItem[] = [
  {
    icon: TrendingUp,
    title: 'Controlo de despesas',
    description: 'Registe despesas, compare-as com o orçamento e exporte-as para Excel',
  },
  {
    icon: Building2,
    title: 'Visão geral do projeto',
    description: 'Dashboard com o progresso, as despesas e o orçamento do projeto',
  },
  {
    icon: Users,
    title: 'Responsáveis da obra',
    description: 'Faça a gestão dos contactos de arquitetos, empreiteiros e fornecedores',
  },
  {
    icon: FileText,
    title: 'Gestão de documentos',
    description: 'Centralize plantas, licenças, contratos e faturas',
  },
  {
    icon: CheckSquare,
    title: 'Checklist por fases',
    description: 'Organize as tarefas por fase da obra e defina datas para não perder prazos',
  },
  {
    icon: Brain,
    title: 'Assistente com IA',
    description:
      'Sugestões de tarefas para a checklist e um chat para esclarecer dúvidas sobre o seu projeto, com limites mensais conforme o plano',
  },
];

export const TARGET_AUDIENCE: IconItem[] = [
  {
    icon: Building2,
    title: 'Construção de casa',
    description: 'Para quem está a construir a casa própria',
  },
  {
    icon: CheckSquare,
    title: 'Renovações',
    description: 'Ideal para projetos de remodelação',
  },
  {
    icon: TrendingUp,
    title: 'Investidores',
    description: 'Para quem gere vários imóveis ao mesmo tempo',
  },
];

export const TRUST_STATS = [
  { value: '100%', label: 'Em português' },
  { value: '0 €', label: 'Para começar' },
  { value: '∞', label: 'Projetos no plano Pro' },
  { value: 'Web', label: 'No computador e no telemóvel' },
];

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

export interface LandingPricingPlan {
  id: 'free' | 'pro' | 'premium';
  name: string;
  description: string;
  /** EUR per month when billed monthly. */
  monthlyPrice: number;
  /** EUR per month when billed annually. */
  annualPrice: number;
  features: { included: string[]; notIncluded: string[] };
  badge?: string;
  popular?: boolean;
  comingSoon?: boolean;
}

/**
 * Mirrors `pricingPlans` in app/profile/page.tsx (the plans shown inside the app).
 * Keep both in sync when prices or plan features change. Informational only: the
 * landing page never reads or writes subscription state.
 */
export const PRICING_PLANS: LandingPricingPlan[] = [
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
        'Chat IA limitado',
      ],
      notIncluded: ['Projetos ilimitados', 'Documentos ilimitados', 'Exportar relatórios'],
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Ideal para profissionais e empresas',
    monthlyPrice: 12.99,
    annualPrice: 10.0,
    features: {
      included: [
        'Projetos ilimitados',
        'Checklist completo',
        'Até 30 documentos com uploads',
        'Responsáveis ilimitados',
        'Exportar relatórios',
        'Sugestões de tarefas IA ilimitadas',
        'Chat IA ilimitado',
        'Sugestões baseadas em fase e tipo',
      ],
      notIncluded: ['Análise financeira avançada', 'Deteção de riscos'],
    },
    badge: 'Mais Popular',
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Recursos avançados para grandes empresas',
    monthlyPrice: 19.99,
    annualPrice: 16.0,
    features: {
      included: [
        'Tudo do Pro',
        'Insights avançados com IA',
        'Análise financeira',
        'Deteção de riscos',
        'Comparação de projetos',
        'Resumos automáticos',
        'Suporte prioritário',
      ],
      notIncluded: [],
    },
    badge: 'Em breve',
    comingSoon: true,
  },
];

export const annualTotal = (plan: LandingPricingPlan) => Math.round(plan.annualPrice * 12 * 100) / 100;

/** Whole-number percentage saved by paying annually instead of 12 monthly payments. */
export function annualSavingsPercent(plan: LandingPricingPlan): number {
  const monthlyTotal = plan.monthlyPrice * 12;
  if (monthlyTotal <= 0) return 0;
  return Math.round((1 - annualTotal(plan) / monthlyTotal) * 100);
}

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const eurWhole = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export const formatEur = (value: number) => eur.format(value);
export const formatEurCompact = (value: number) => eurWhole.format(value);
