import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const cardVariants = cva(
  'rounded-[var(--bento-radius,var(--radius-lg))] border border-border/70 bg-surface text-text shadow-[var(--shadow-soft)] backdrop-blur transition-all duration-300',
  {
    variants: {
      tone: {
        default: 'bg-surface',
        muted: 'bg-surface-2',
        translucent: 'bg-white/5 dark:bg-white/2 border-white/10 shadow-[0_20px_80px_-40px_rgba(var(--accent-rgb),0.4)]',
        // Bento Gradient Variants
        'bento-purple': 'bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] border-purple-500/20 text-white shadow-[var(--shadow-bento)]',
        'bento-teal': 'bg-gradient-to-br from-[#14b8a6] to-[#06b6d4] border-teal-500/20 text-white shadow-[var(--shadow-bento)]',
        'bento-orange': 'bg-gradient-to-br from-[#f97316] to-[#fb923c] border-orange-500/20 text-white shadow-[var(--shadow-bento)]',
        'bento-green': 'bg-gradient-to-br from-[#10b981] to-[#059669] border-green-500/20 text-white shadow-[var(--shadow-bento)]',
        'bento-red': 'bg-gradient-to-br from-[#ef4444] to-[#dc2626] border-red-500/20 text-white shadow-[var(--shadow-bento)]',
        'bento-blue': 'bg-gradient-to-br from-[#3b82f6] to-[#2563eb] border-blue-500/20 text-white shadow-[var(--shadow-bento)]',
        // Bento Solid Variants
        'bento-solid-purple': 'bg-[#8b5cf6] border-purple-500/30 text-white shadow-[var(--shadow-bento)]',
        'bento-solid-teal': 'bg-[#14b8a6] border-teal-500/30 text-white shadow-[var(--shadow-bento)]',
        'bento-solid-orange': 'bg-[#f97316] border-orange-500/30 text-white shadow-[var(--shadow-bento)]',
        'bento-solid-green': 'bg-[#10b981] border-green-500/30 text-white shadow-[var(--shadow-bento)]',
        'bento-solid-red': 'bg-[#ef4444] border-red-500/30 text-white shadow-[var(--shadow-bento)]',
        'bento-solid-blue': 'bg-[#3b82f6] border-blue-500/30 text-white shadow-[var(--shadow-bento)]',
      },
      interactive: {
        true: 'transition-all duration-300 hover:border-accent/40 hover:shadow-[var(--shadow-strong)] hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] cursor-pointer'
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        bento: 'p-[var(--bento-padding,24px)]'
      },
      bento: {
        true: 'rounded-[var(--bento-radius)] shadow-[var(--shadow-bento)] border-border/50'
      }
    },
    defaultVariants: {
      tone: 'default',
      padding: 'md'
    }
  }
);

type CardElement = 'div' | 'section' | 'article' | 'button';

type CardProps<T extends CardElement = 'div'> = {
  as?: T;
  className?: string;
  bento?: boolean;
} & VariantProps<typeof cardVariants> &
  Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className'>;

const CardComponent = React.forwardRef<HTMLElement, CardProps<'div'>>(
  ({ as = 'div', className, tone, interactive, padding, bento, ...props }, ref) => {
    const Component = as as any;
    return (
      <Component
        ref={ref}
        className={cn(cardVariants({ tone, interactive, padding, bento }), className)}
        {...props}
      />
    );
  }
);

CardComponent.displayName = 'Card';

export const Card = CardComponent as <T extends CardElement = 'div'>(
  props: CardProps<T> & { ref?: React.Ref<HTMLElement> }
) => React.ReactElement;

(Card as any).displayName = 'Card';
