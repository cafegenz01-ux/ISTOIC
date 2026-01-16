import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DialogProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'full';
    children: React.ReactNode;
    footer?: React.ReactNode;
}

const getSizeClass = (size: DialogProps['size']) => {
    switch (size) {
        case 'sm': return 'max-w-md';
        case 'lg': return 'max-w-4xl';
        case 'full': return 'w-full h-full max-w-none';
        default: return 'max-w-2xl';
    }
};

/**
 * Dialog Component - iOS Hardened
 * 
 * iOS Fixes:
 * - max-height uses dvh with safe-area subtraction
 * - Content scrolls inside modal (not page)
 * - Footer sticky with safe-area padding
 * - Reduced backdrop-filter for performance
 * - Proper z-index management
 * - Keyboard trap handling
 */
export const Dialog: React.FC<DialogProps> = ({ open, onClose, title, size = 'md', children, footer }) => {
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey)) onClose();
        };
        
        if (open) {
            previouslyFocused.current = document.activeElement as HTMLElement;
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKey);
            
            // Focus first focusable element
            setTimeout(() => {
                const node = overlayRef.current;
                const focusable = node?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                focusable?.focus();
            }, 0);
        } else {
            document.body.style.overflow = '';
        }
        
        return () => {
            window.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
            previouslyFocused.current?.focus();
        };
    }, [open, onClose]);

    if (!open) return null;

    const content = (
        <div
            ref={overlayRef}
            className={cn(
                'fixed inset-0 z-[1200]',
                'bg-[rgb(var(--overlay-rgb)/0.6)]',
                'backdrop-blur-sm', // Reduced for mobile performance
                'flex items-center justify-center',
                'px-4 py-10 md:py-16',
                'safe-t safe-b' // iOS safe-area support
            )}
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-label={title || 'Dialog'}
            onKeyDown={(e) => {
                // Trap focus inside dialog
                if (e.key !== 'Tab') return;
                const focusables = overlayRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (!focusables || focusables.length === 0) return;
                
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }}
        >
            <div 
                className={cn(
                    'relative w-full',
                    getSizeClass(size),
                    'modal-container', // iOS safe max-height from CSS
                    'overflow-hidden',
                    'rounded-[var(--radius-lg)]',
                    'border border-border',
                    'bg-surface',
                    'shadow-[var(--shadow-strong)]',
                    'flex flex-col',
                    'transform-gpu' // GPU acceleration
                )}
            >
                {/* Header */}
                <div className={cn(
                    'flex items-start justify-between gap-4',
                    'px-6 py-4',
                    'border-b border-border',
                    'bg-surface-2',
                    'shrink-0'
                )}>
                    <div>
                        <p className="overline text-text-muted">{title || 'Dialog'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className={cn(
                            'w-10 h-10 rounded-full',
                            'flex items-center justify-center',
                            'text-text-muted hover:text-text',
                            'hover:bg-surface',
                            'transition-all',
                            'touch-target' // iOS minimum hit target
                        )}
                        aria-label="Close dialog"
                        type="button"
                    >
                        <X size={18} />
                    </button>
                </div>
                
                {/* Scrollable Content */}
                <div className={cn(
                    'flex-1 overflow-auto',
                    'modal-content', // iOS scroll handling from CSS
                    'px-6 py-5',
                    'custom-scroll',
                    'bg-surface'
                )}>
                    {children}
                </div>
                
                {/* Footer (Sticky if needed) */}
                {footer && (
                    <div className={cn(
                        'modal-footer', // Sticky with safe-area from CSS
                        'px-6 py-4',
                        'flex items-center justify-end gap-3',
                        'shrink-0'
                    )}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(content, document.body);
};