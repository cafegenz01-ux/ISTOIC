import React from 'react';
import { cn } from '../../utils/cn';

interface BottomDockProps {
  children: React.ReactNode;
  className?: string;
  keyboardOffset?: number;
}

/**
 * BottomDock - Sticky bottom container for actions/inputs
 * 
 * Features:
 * - Sticky positioning inside parent (not fixed to viewport)
 * - Safe-area padding for iOS notch/home indicator
 * - Optional keyboard offset via CSS variable
 * - Surface background with border
 * 
 * Usage:
 * <BottomDock>
 *   <ChatInput />
 * </BottomDock>
 */
export const BottomDock: React.FC<BottomDockProps> = ({
  children,
  className,
  keyboardOffset = 0
}) => {
  return (
    <div
      className={cn(
        'sticky bottom-0 left-0 right-0 z-10',
        'bg-surface border-t border-border',
        'safe-b',
        className
      )}
      style={{
        paddingBottom: keyboardOffset 
          ? `calc(env(safe-area-inset-bottom) + ${keyboardOffset}px)` 
          : undefined
      }}
    >
      {children}
    </div>
  );
};
