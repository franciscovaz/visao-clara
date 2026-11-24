import { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { FORM_CONTROL_CLASS } from './formControl';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Native <select> with the shared form-control look. Pass <option> children as usual. */
const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(FORM_CONTROL_CLASS, 'h-10', className)} {...props} />
));

Select.displayName = 'Select';

export { Select };
