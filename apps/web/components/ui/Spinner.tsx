import { cn } from '@/lib/utils';

export type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  /** sm = 16px (inside buttons), md = 32px (section loading, the common case), lg = 48px (full page). */
  size?: SpinnerSize;
  /** `brand` = the existing blue spinner; `current` = inherits the text colour (e.g. inside a button). */
  tone?: 'brand' | 'current';
  /** Screen-reader text. Pass `null` when the spinner is decorative (e.g. a button already marked aria-busy). */
  label?: string | null;
  className?: string;
}

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

/** The app's existing loading idiom (`animate-spin rounded-full border-b-2 border-blue-600`) as a component. */
export function Spinner({ size = 'md', tone = 'brand', label = 'A carregar…', className }: SpinnerProps) {
  const circle = (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-b-2',
        SIZE_CLASSES[size],
        tone === 'brand' ? 'border-brand' : 'border-current',
        className
      )}
    />
  );

  if (label === null) return circle;

  return (
    <span role="status" className="inline-flex">
      {circle}
      <span className="sr-only">{label}</span>
    </span>
  );
}
