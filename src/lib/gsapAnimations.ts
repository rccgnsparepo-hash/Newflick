import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Initialize lightweight entrance animations without hijacking or attaching proxy listeners to scrollers.
 */
export function initGSAPScrollTriggers() {
  // Non-blocking safe stub to ensure native browser scrolling is 100% free and unhindered
}

/**
 * Trigger GSAP refresh safely without attaching scroll interceptors.
 */
export function refreshScrollTrigger() {
  // Safe no-op
}

/**
 * React hook for safe scroll animations.
 */
export function useGSAPScroll(_deps: any[] = []) {
  // Safe no-op
}
