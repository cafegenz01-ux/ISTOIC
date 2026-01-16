import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

/**
 * ScrollArea - Reusable scroll container
 * 
 * Features:
 * - flex-1 to take available space in parent
 * - overflow-y-auto for vertical scrolling
 * - overscroll-contain to prevent scroll chaining
 * - -webkit-overflow-scrolling:touch for iOS momentum
 * 
 * Usage:
 * <ScrollArea className="px-4">
 *   {content}
 * </ScrollArea>
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex-1 overflow-y-auto overscroll-contain',
          '[-webkit-overflow-scrolling:touch]',
          'custom-scroll',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ScrollArea.displayName = 'ScrollArea';
