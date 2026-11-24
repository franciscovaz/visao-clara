import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface AuthShellProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Optional content below the card body (links, legal notice) */
  footer?: ReactNode;
}

/**
 * Shared frame of the authentication screens (Figma AuthScreen): soft blue gradient, centred
 * max-w-md card, Building2 brand mark, title and description. Visual only.
 */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 px-4 py-8">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 space-y-4 text-center">
          <div className="flex justify-center">
            <Building2 className="h-12 w-12 text-blue-600" aria-hidden="true" />
          </div>
          <p className="sr-only">Visão Clara</p>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {description && <p className="text-sm text-gray-500">{description}</p>}
        </div>
        {children}
        {footer && <div className="mt-6">{footer}</div>}
      </Card>
    </div>
  );
}

interface AuthMessageProps {
  tone: 'error' | 'success';
  children: ReactNode;
  className?: string;
}

/** Inline error/success message of the auth screens. Errors are announced immediately. */
export function AuthMessage({ tone, children, className }: AuthMessageProps) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 text-sm',
        tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700',
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 wrap-anywhere">{children}</div>
    </div>
  );
}

/** Separator between Google sign-in and the email form */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-white px-2 text-gray-500">{label}</span>
      </div>
    </div>
  );
}

/** Text link between auth screens (client-side navigation) */
export function AuthLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded font-medium text-blue-600 outline-none hover:text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
    >
      {children}
    </Link>
  );
}

/** Legal notice shown below the login and registration forms */
export function AuthLegalNotice() {
  const linkClass = 'rounded underline outline-none hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <p className="text-center text-xs text-gray-500">
      Ao continuar, aceita os nossos{' '}
      <Link href="/termos" target="_blank" rel="noopener noreferrer" className={linkClass}>
        Termos de Serviço
      </Link>{' '}
      e a{' '}
      <Link href="/privacidade" target="_blank" rel="noopener noreferrer" className={linkClass}>
        Política de Privacidade
      </Link>
      .
    </p>
  );
}
