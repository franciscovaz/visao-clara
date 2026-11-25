import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Back / Skip / Continue actions */
  footer: ReactNode;
}

/**
 * Shared frame of the onboarding steps (Figma OnboardingWizard): soft blue gradient, centred
 * max-w-2xl card, progress, step title and description, actions row. Visual only.
 */
export function OnboardingShell({ step, totalSteps, title, description, children, footer }: OnboardingShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-8">
      <Card className="w-full max-w-2xl p-6 md:p-8">
        {/* Figma: bar first, single step counter below */}
        <div className="mb-6 space-y-2">
          <ProgressBar current={step} total={totalSteps} label={`Passo ${step} de ${totalSteps}`} showLabel={false} />
          <p className="text-sm text-gray-500">Passo {step} de {totalSteps}</p>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {description && <p className="mt-2 text-base text-gray-500">{description}</p>}
        </div>

        <div className="mb-8">{children}</div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-6">{footer}</div>
      </Card>
    </div>
  );
}

/** Group of option cards with an accessible name (the step title) */
export function OptionGrid({ label, children, columns = 2 }: { label: string; children: ReactNode; columns?: 2 | 3 }) {
  return (
    <div role="group" aria-label={label} className={columns === 3 ? 'grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4' : 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4'}>
      {children}
    </div>
  );
}
