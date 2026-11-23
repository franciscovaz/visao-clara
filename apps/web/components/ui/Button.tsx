import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'full' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and sets aria-busy. Keep the label text (e.g. "A guardar…"). */
  loading?: boolean;
}

const BASE_CLASSES =
  'inline-flex cursor-pointer items-center justify-center rounded-lg font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // `primary` and `secondary` keep their pre-design-system colours so existing screens don't change.
  // They move to the tokens (bg-primary = Figma #030213) when pages are migrated.
  primary: 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-ring',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-ring',
  outline:
    'border border-border bg-white text-gray-900 hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring',
  // Explicit text colour so the ghost button does not depend on what it is placed in
  ghost: 'text-gray-900 hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
  full: 'w-full px-6 py-3 text-base',
  // Icon-only buttons must have an aria-label
  icon: 'h-9 w-9 p-0',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <Spinner size="sm" tone="current" label={null} className={size === 'icon' ? undefined : '-ml-1 mr-2'} />
        )}
        {loading && size === 'icon' ? null : children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
