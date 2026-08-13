import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Initialize deep GSAP ScrollTrigger movements globally across all scrollable containers.
 */
export function initGSAPScrollTriggers() {
  if (typeof window === 'undefined') return;

  // Refresh existing triggers cleanly
  ScrollTrigger.refresh();

  // 1. Target all scrollable containers (main content area, feed, chat lists)
  const scrollContainers = document.querySelectorAll('.overflow-y-auto, [data-gsap-container]');

  scrollContainers.forEach((container) => {
    // Reveal & Depth Scale for scroll cards (.gsap-reveal, .glass-panel)
    const cards = container.querySelectorAll('.gsap-reveal, .gsap-scroll-card');
    
    cards.forEach((card) => {
      // Avoid duplicate triggers
      if (card.getAttribute('data-gsap-initialized') === 'true') return;
      card.setAttribute('data-gsap-initialized', 'true');

      gsap.fromTo(
        card,
        {
          opacity: 0.2,
          y: 35,
          scale: 0.96,
          rotateX: -4,
          transformPerspective: 1000
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          rotateX: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            scroller: container,
            start: 'top 92%',
            end: 'top 40%',
            toggleActions: 'play none none reverse',
            scrub: 0.5
          }
        }
      );
    });

    // 2. Deep Parallax for imagery and ambient glows (.gsap-parallax)
    const parallaxElements = container.querySelectorAll('.gsap-parallax');
    parallaxElements.forEach((el) => {
      if (el.getAttribute('data-gsap-initialized') === 'true') return;
      el.setAttribute('data-gsap-initialized', 'true');

      const speed = parseFloat(el.getAttribute('data-parallax-speed') || '0.2');

      gsap.to(el, {
        y: (i, target) => -target.offsetHeight * speed,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          scroller: container,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });

    // 3. Staggered reveal groups (.gsap-stagger-group)
    const groups = container.querySelectorAll('.gsap-stagger-group');
    groups.forEach((group) => {
      if (group.getAttribute('data-gsap-initialized') === 'true') return;
      group.setAttribute('data-gsap-initialized', 'true');

      const children = group.children;
      if (children.length > 0) {
        gsap.fromTo(
          Array.from(children),
          { opacity: 0, y: 25, scale: 0.97 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.5,
            stagger: 0.08,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: group,
              scroller: container,
              start: 'top 88%',
              toggleActions: 'play none none none'
            }
          }
        );
      }
    });

    // 4. Header shrink & glass blur intensification on scroll
    const stickyHeaders = container.querySelectorAll('.sticky.top-0, [data-gsap-sticky]');
    stickyHeaders.forEach((header) => {
      if (header.getAttribute('data-gsap-initialized') === 'true') return;
      header.setAttribute('data-gsap-initialized', 'true');

      gsap.to(header, {
        boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
        scale: 0.995,
        duration: 0.3,
        scrollTrigger: {
          trigger: container,
          scroller: container,
          start: 'top -20px',
          toggleActions: 'play reverse play reverse',
          scrub: 0.2
        }
      });
    });
  });
}

/**
 * Trigger GSAP ScrollTrigger refresh after async data updates or navigation.
 */
export function refreshScrollTrigger() {
  if (typeof window === 'undefined') return;
  setTimeout(() => {
    ScrollTrigger.refresh();
    initGSAPScrollTriggers();
  }, 100);
}

/**
 * React hook to automatically trigger GSAP ScrollTrigger initialization and refreshes on component mount/update.
 */
export function useGSAPScroll(deps: any[] = []) {
  if (typeof window === 'undefined') return;

  gsap.ticker.lagSmoothing(1000, 16);

  setTimeout(() => {
    initGSAPScrollTriggers();
  }, 150);
}
