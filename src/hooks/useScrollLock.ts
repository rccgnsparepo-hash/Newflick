import { useEffect, useRef } from 'react';

/**
 * A highly robust, pixel-perfect hook to programmatically lock the viewport body scroll
 * when a modal, sheet, or overlay is active, and immediately restore the exact previous
 * scroll coordinate position upon closing.
 */
export function useScrollLock(isOpen: boolean) {
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isOpen) {
      // 1. Capture the exact vertical scroll coordinate
      const currentScroll = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      scrollPositionRef.current = currentScroll;

      // 2. Save original style values
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalWidth = document.body.style.width;
      const originalTop = document.body.style.top;

      // 3. Programmatically lock scrolling with offset-retention to prevent scroll page jumps
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${currentScroll}px`;

      return () => {
        // 4. Reset style properties back to original
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = originalWidth;
        document.body.style.top = originalTop;

        // 5. Restore previous pixel-perfect scroll position immediately
        window.scrollTo({
          top: scrollPositionRef.current,
          behavior: 'instant' as any
        });
      };
    }
  }, [isOpen]);
}
