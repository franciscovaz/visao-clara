import type { ComponentProps, CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/**
 * Landing-page-only primitives. They reproduce the shadcn/ui Button, Badge and Card
 * used by the Figma Make design (exported to ~/Downloads/Visão Clara Web App Design)
 * without adding dependencies and without touching the app-wide components/ui/*.
 *
 * Colours come from the design's theme tokens, scoped to the landing page wrapper as
 * CSS custom properties (see `landingThemeStyle`), so app pages are unaffected.
 */

export const landingThemeStyle = {
  '--lp-bg': '#ffffff',
  '--lp-fg': 'oklch(0.145 0 0)',
  '--lp-card': '#ffffff',
  '--lp-primary': '#030213',
  '--lp-primary-fg': 'oklch(1 0 0)',
  '--lp-secondary': 'oklch(0.95 0.0058 264.53)',
  '--lp-secondary-fg': '#030213',
  '--lp-muted': '#ececf0',
  '--lp-muted-fg': '#717182',
  '--lp-accent': '#e9ebef',
  '--lp-accent-fg': '#030213',
  '--lp-destructive': '#d4183d',
  '--lp-border': 'rgba(0, 0, 0, 0.1)',
  '--lp-ring': 'oklch(0.708 0 0)',
  // The design uses Tailwind's default sans stack (its fonts.css is empty)
  fontFamily:
    "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
} as CSSProperties;

export type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'outline-inverse';
export type ButtonSize = 'default' | 'sm' | 'lg';

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-sm font-medium transition-all shrink-0 outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:ring-[3px] focus-visible:ring-(--lp-ring)/50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: 'bg-(--lp-primary) text-(--lp-primary-fg) hover:bg-(--lp-primary)/90',
  outline:
    'border border-(--lp-border) bg-(--lp-bg) text-(--lp-fg) hover:bg-(--lp-accent) hover:text-(--lp-accent-fg)',
  secondary: 'bg-(--lp-secondary) text-(--lp-secondary-fg) hover:bg-(--lp-secondary)/80',
  ghost: 'hover:bg-(--lp-accent) hover:text-(--lp-accent-fg)',
  // Outline button on the gradient CTA section
  'outline-inverse': 'border border-white bg-transparent text-white hover:bg-white/10',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  default: 'h-9 px-4 py-2 has-[>svg]:px-3',
  sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
  lg: 'h-10 px-6 has-[>svg]:px-4',
};

export function buttonClasses({
  variant = 'default',
  size = 'default',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

type BadgeVariant = 'default' | 'secondary';

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  default: 'bg-(--lp-primary) text-(--lp-primary-fg)',
  secondary: 'bg-(--lp-secondary) text-(--lp-secondary-fg)',
};

export function Badge({
  variant = 'default',
  className,
  ...props
}: ComponentProps<'span'> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[8px] border border-transparent px-2 py-0.5 text-xs font-medium',
        BADGE_VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  borderClassName = 'border-(--lp-border)',
  ...props
}: ComponentProps<'div'> & { borderClassName?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6 rounded-[14px] border bg-(--lp-card) text-(--lp-fg)',
        borderClassName,
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 pt-6', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<'h4'>) {
  return <h4 className={cn('text-base font-medium leading-none', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-(--lp-muted-fg)', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-6 last:pb-6', className)} {...props} />;
}

export function SectionHeading({
  title,
  subtitle,
  className,
  subtitleClassName,
}: {
  title: string;
  subtitle: string;
  className?: string;
  subtitleClassName?: string;
}) {
  return (
    <div className={cn('mx-auto mb-16 max-w-3xl text-center', className)}>
      <h2 className="mb-6 text-3xl font-bold md:text-5xl">{title}</h2>
      <p className={cn('text-lg text-(--lp-muted-fg)', subtitleClassName)}>{subtitle}</p>
    </div>
  );
}
