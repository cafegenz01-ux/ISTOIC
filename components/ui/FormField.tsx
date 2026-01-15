import React from 'react';
import { cn } from '../../utils/cn';

interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, hint, error, className, children }) => (
  <div className={cn('space-y-2', className)}>
    {label && <label className="text-xs font-semibold text-text-muted">{label}</label>}
    {children}
    {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    {!error && hint && <p className="text-xs text-text-muted">{hint}</p>}
  </div>
);
