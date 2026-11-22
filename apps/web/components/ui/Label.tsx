import { LabelHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

/**
 * Form label matching the most common existing pattern
 * (`block text-sm font-medium text-gray-700 mb-2`). Always pass `htmlFor`.
 * Override the spacing with `className` (e.g. `mb-1`).
 */
const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('mb-2 block text-sm font-medium text-gray-700', className)} {...props} />
));

Label.displayName = 'Label';

export { Label };
