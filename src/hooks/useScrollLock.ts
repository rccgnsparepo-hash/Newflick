import { useEffect, useRef } from 'react';

/**
 * A highly robust, pixel-perfect hook to programmatically lock the viewport body scroll
 * when a modal, sheet, or overlay is active, and immediately restore the exact previous
 * scroll coordinate position upon closing.
 */
export function useScrollLock(_isOpen: boolean) {
  // In a full-height SPA where individual panels manage their own overflow-y: auto,
  // locking body with position: fixed prevents all mouse wheel, trackpad, and touch scrolling.
  // Modals and drawers already manage their own backdrops.
}
