import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  outline: 'border-border text-gray-900',
  destructive: 'border-transparent bg-destructive text-destructive-foreground',
  // Soft status tones (task/document/plan states)
  success: 'border-transparent bg-green-100 text-green-800',
  warning: 'border-transparent bg-amber-100 text-amber-800',
  info: 'border-transparent bg-brand-muted text-blue-700',
};

/** Small status/label pill, styled after the Figma Make Badge. Not interactive. */
export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium [&>svg]:size-3 [&>svg]:shrink-0',
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
