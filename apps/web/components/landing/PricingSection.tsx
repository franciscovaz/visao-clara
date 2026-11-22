'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  buttonClasses,
} from './primitives';
import {
  LANDING_ANCHORS,
  LANDING_ROUTES,
  PRICING_PLANS,
  annualSavingsPercent,
  annualTotal,
  formatEur,
  formatEurCompact,
  type LandingPricingPlan,
} from './landingContent';

type BillingPeriod = 'monthly' | 'yearly';

const MAX_ANNUAL_SAVINGS = Math.max(...PRICING_PLANS.map(annualSavingsPercent));

function PlanPrice({ plan, billingPeriod }: { plan: LandingPricingPlan; billingPeriod: BillingPeriod }) {
  if (plan.id === 'free') {
    return (
      <div className="mt-4">
        <span className="text-4xl font-bold">Gratuito</span>
      </div>
    );
  }

  const isYearly = billingPeriod === 'yearly';
  const price = isYearly ? plan.annualPrice : plan.monthlyPrice;

  return (
    <div className="mt-4">
      <span className="text-4xl font-bold">{formatEur(price)}</span>
      <span className="text-(--lp-muted-fg)">/mês</span>
      {isYearly && (
        <p className="mt-1 text-sm text-(--lp-muted-fg)">
          Faturado anualmente ({formatEurCompact(annualTotal(plan))}/ano) · poupa {annualSavingsPercent(plan)}%
        </p>
      )}
    </div>
  );
}

function PlanFeatures({ plan }: { plan: LandingPricingPlan }) {
  return (
    <ul className="space-y-3">
      {plan.features.included.map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          {plan.comingSoon ? (
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-(--lp-muted-fg)" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-(--lp-primary)" aria-hidden="true" />
          )}
          <span className={plan.comingSoon ? 'text-(--lp-muted-fg)' : undefined}>{feature}</span>
        </li>
      ))}
      {plan.features.notIncluded.map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-(--lp-muted-fg)" aria-hidden="true" />
          <span className="text-(--lp-muted-fg)">
            <span className="sr-only">Não incluído: </span>
            {feature}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PlanAction({ plan }: { plan: LandingPricingPlan }) {
  if (plan.comingSoon) {
    return (
      <button type="button" disabled className={buttonClasses({ variant: 'outline', className: 'w-full' })}>
        Em breve
      </button>
    );
  }

  return (
    <Link
      href={LANDING_ROUTES.start}
      className={buttonClasses({ variant: plan.popular ? 'default' : 'outline', className: 'w-full' })}
    >
      {plan.id === 'free' ? 'Começar grátis' : 'Criar conta'}
    </Link>
  );
}

export function PricingSection() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const isYearly = billingPeriod === 'yearly';

  return (
    <section id={LANDING_ANCHORS.pricing} className="bg-(--lp-bg) py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold md:text-5xl">Preços simples e transparentes</h2>
          <p className="mb-8 text-lg text-(--lp-muted-fg)">
            Comece grátis e mude de plano quando precisar de mais
          </p>

          {/* Billing toggle */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span className={isYearly ? 'text-(--lp-muted-fg)' : 'font-medium'}>Mensal</span>
            <button
              type="button"
              role="switch"
              aria-checked={isYearly}
              aria-label="Faturação anual"
              onClick={() => setBillingPeriod(isYearly ? 'monthly' : 'yearly')}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-(--lp-ring)/50',
                isYearly ? 'bg-(--lp-primary)' : 'bg-(--lp-muted)'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  isYearly ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
            <span className={isYearly ? 'font-medium' : 'text-(--lp-muted-fg)'}>Anual</span>
            {isYearly && <Badge className="ml-2">Poupe até {MAX_ANNUAL_SAVINGS}%</Badge>}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          {PRICING_PLANS.map((plan) => (
            <Card
              key={plan.id}
              borderClassName={plan.popular ? 'border-(--lp-primary)' : undefined}
              className={cn('relative', plan.popular && 'scale-105 shadow-lg', plan.comingSoon && 'opacity-75')}
            >
              {plan.badge && (
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                  <Badge variant={plan.popular ? 'default' : 'secondary'}>{plan.badge}</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <PlanPrice plan={plan} billingPeriod={billingPeriod} />
              </CardHeader>
              <CardContent className="space-y-6">
                {plan.comingSoon && (
                  <p className="text-sm text-(--lp-muted-fg)">
                    Plano em desenvolvimento: estas funcionalidades ainda não estão disponíveis.
                  </p>
                )}
                <PlanFeatures plan={plan} />
                <PlanAction plan={plan} />
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-(--lp-muted-fg)">
          Preços informativos. Durante a fase beta, os planos pagos ainda não podem ser subscritos na aplicação.
        </p>
      </div>
    </section>
  );
}
