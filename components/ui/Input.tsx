import React from 'react';
import { cn } from '../../utils/cn';

const baseInputClass =
  'w-full rounded-[var(--radius-md)] border border-border/70 bg-surface px-3 py-2 text-text placeholder:text-text-muted transition-all shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] hover:border-[color:var(--primary)]/40 disabled:cursor-not-allowed disabled:opacity-50';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(baseInputClass, className)} {...props} />
  )
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(baseInputClass, 'min-h-[120px] resize-y', className)} {...props} />
  )
);

Textarea.displayName = 'Textarea';
