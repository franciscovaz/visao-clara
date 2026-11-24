import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { FORM_CONTROL_CLASS } from './formControl';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Native <textarea> with the shared form-control look; vertically resizable. */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(FORM_CONTROL_CLASS, 'block min-h-20 resize-y py-2', className)} {...props} />
));

Textarea.displayName = 'Textarea';

export { Textarea };
