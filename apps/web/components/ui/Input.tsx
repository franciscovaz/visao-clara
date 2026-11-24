import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { FORM_CONTROL_CLASS } from './formControl';

type InputProps = InputHTMLAttributes<HTMLInputElement>

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(FORM_CONTROL_CLASS, 'flex h-10 py-2', className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
