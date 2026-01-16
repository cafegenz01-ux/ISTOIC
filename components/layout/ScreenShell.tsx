import React from 'react';
import { cn } from '../../utils/cn';

interface ScreenShellProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * ScreenShell - Foundation layout component for all views
 * 
 * Architecture:
 * - Uses min-app-dvh for proper iOS viewport handling
 * - Flex column with overflow hidden to prevent double scroll
 * - Header/Footer in normal flow (not fixed to viewport)
 * - Content area handles its own scroll via ScrollArea
 * 
 * Usage:
 * <ScreenShell header={<Header />} footer={<Footer />}>
 *   <ScrollArea>{content}</ScrollArea>
 * </ScreenShell>
 */
export const ScreenShell: React.FC<ScreenShellProps> = ({
  children,
  header,
  footer,
  className
}) => {
  return (
    <div className={cn(
      'min-app-dvh flex flex-col overflow-hidden bg-bg',
      className
    )}>
      {header && (
        <div className="shrink-0 safe-t">
          {header}
        </div>
      )}
      
      <div className="flex-1 min-h-0 relative">
        {children}
      </div>
      
      {footer && (
        <div className="shrink-0 safe-b">
          {footer}
        </div>
      )}
    </div>
  );
};
