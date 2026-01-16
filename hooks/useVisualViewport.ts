import { useState, useEffect, useRef } from 'react';

interface VisualViewportState {
  height: number;
  offsetTop: number;
  keyboardHeight: number;
  isKeyboardOpen: boolean;
}

/**
 * useVisualViewport - Track iOS keyboard and viewport changes
 * 
 * Returns:
 * - height: Current visual viewport height
 * - offsetTop: Viewport offset from top (for scrolled keyboards)
 * - keyboardHeight: Approximate keyboard height
 * - isKeyboardOpen: Boolean if keyboard is visible
 * 
 * Safe on non-iOS: Returns default values gracefully
 * 
 * Usage:
 * const { keyboardHeight, isKeyboardOpen } = useVisualViewport();
 */
export const useVisualViewport = (): VisualViewportState => {
  const [state, setState] = useState<VisualViewportState>({
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
    offsetTop: 0,
    keyboardHeight: 0,
    isKeyboardOpen: false
  });

  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Graceful fallback if visualViewport not supported
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    const viewport = window.visualViewport;

    const updateViewport = () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        const layoutHeight = window.innerHeight;
        const visualHeight = viewport.height;
        const offsetTop = viewport.offsetTop;
        
        // Keyboard height = difference between layout and visual viewport
        const keyboardHeight = Math.max(0, layoutHeight - visualHeight - offsetTop);
        const isKeyboardOpen = keyboardHeight > 100; // Threshold: 100px

        setState({
          height: visualHeight,
          offsetTop,
          keyboardHeight,
          isKeyboardOpen
        });

        rafId.current = null;
      });
    };

    // Initial update
    updateViewport();

    // Listen to resize and scroll events
    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);

    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
      
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return state;
};
