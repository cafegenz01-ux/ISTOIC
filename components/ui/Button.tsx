import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-semibold transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-50 active:translate-y-0.5',
  {
    variants: {
      variant: {
        primary:
          'bg-[color:var(--primary)] text-[color:var(--primary-contrast)] shadow-[var(--shadow-soft)] hover:brightness-95',
        secondary:
          'bg-[color:var(--surface)] text-text border border-border/70 hover:border-[color:var(--primary)]/40 hover:bg-surface-2 shadow-[var(--shadow-soft)]',
        ghost: 'bg-transparent text-text hover:bg-surface-2 border border-transparent hover:border-border/60',
        destructive: 'bg-danger text-[color:var(--primary-contrast)] hover:brightness-95 shadow-[var(--shadow-soft)]',
        subtle: 'bg-surface-2 text-text border border-border/60 hover:border-[color:var(--primary)]/30 hover:bg-surface shadow-[var(--shadow-soft)]'
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-5 text-sm'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);

Button.displayName = 'Button';
