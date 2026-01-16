
import { useState, useEffect, useRef } from 'react';

export const useNavigationIntelligence = () => {
  // Default visible to prevent "disappearing" bug on load
  const [isVisible, setIsVisible] = useState(true);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  
  const lastScrollY = useRef(0);
  const scrollThreshold = 10; // Sensitivity

  // Real-time UI analysis without heavy polling
  useEffect(() => {
    const checkUIState = () => {
      const activeEl = document.activeElement;
      const isFocused = activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'INPUT';
      
      // Update state only if changed to prevent re-renders
      setIsInputFocused(prev => prev !== isFocused ? isFocused : prev);
      
      const selection = window.getSelection();
      const hasSelection = selection && selection.toString().length > 0;
      setIsSelectionActive(!!hasSelection);

      // Check for forced overlays (Modals, etc)
      const bodyHasLock = document.body.style.overflow === 'hidden';
      setIsOverlayOpen(bodyHasLock);
    };

    // Use MutationObserver for DOM changes affecting overlay state
    const observer = new MutationObserver(checkUIState);
    observer.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });

    // Listeners for interaction
    window.addEventListener('focusin', checkUIState);
    window.addEventListener('focusout', checkUIState);
    document.addEventListener('selectionchange', checkUIState);

    return () => {
      observer.disconnect();
      window.removeEventListener('focusin', checkUIState);
      window.removeEventListener('focusout', checkUIState);
      document.removeEventListener('selectionchange', checkUIState);
    };
  }, []);

  // Scroll Intelligence
  useEffect(() => {
    const scrollTarget = document.getElementById('main-scroll-container') || window;

    const handleScroll = () => {
      // Determine correct scroll position based on target type
      const currentScrollY = scrollTarget instanceof HTMLElement 
        ? scrollTarget.scrollTop 
        : (window.scrollY || document.documentElement.scrollTop);
      
      // Safety: If at top of page, ALWAYS show nav
      if (currentScrollY < 50) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      // If keyboard is open, keep nav hidden to save space, 
      // BUT let it reappear if user forces scroll up significantly
      if (isInputFocused) {
         if (lastScrollY.current - currentScrollY > 40) {
             // User really wants to see nav even with keyboard open
             setIsVisible(true);
         } else {
             setIsVisible(false);
         }
      } else {
          // Normal behavior
          if (currentScrollY > lastScrollY.current + scrollThreshold) {
            // Scrolling Down -> Hide
            setIsVisible(false);
          } else if (lastScrollY.current - currentScrollY > scrollThreshold) {
            // Scrolling Up -> Show
            setIsVisible(true);
          }
      }

      lastScrollY.current = currentScrollY;
    };

    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener('scroll', handleScroll);
  }, [isInputFocused]);

  // Priority Logic:
  // 1. If overlay is open (Modal) -> Hide Nav
  // 2. If text is selected (Batch Action) -> Hide Nav
  // 3. If input focused -> Hide Nav (usually), unless forced by scroll logic inside handleScroll
  // 4. Otherwise -> Follow scroll direction
  
  const isForcedStealth = isOverlayOpen || isSelectionActive;
  
  // Final decision
  const shouldShowNav = !isForcedStealth && isVisible;

  return { shouldShowNav, isForcedStealth, isInputFocused };
};
