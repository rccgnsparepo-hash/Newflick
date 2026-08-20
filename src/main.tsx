import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import App from './App';
import { initBootstrap } from './lib/bootstrap';

const originalConsoleError = console.error;
console.error = function(...args) {
  const msg = args.map(arg => {
    if (arg instanceof Error) return arg.message + ' ' + (arg.stack || '');
    if (typeof arg === 'object' && arg !== null) {
      try { return JSON.stringify(arg); } catch (e) { return String(arg); }
    }
    return String(arg);
  }).join(' ');

  if (
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('permission-denied') ||
    msg.includes('ResizeObserver')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Prevent ResizeObserver loop limit exceeded error from bubbling up as a fatal error
window.addEventListener('error', (e) => {
  const msg = e.message || (e.error && e.error.message) || String(e);
  if (
    msg.includes('ResizeObserver') ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('permission-denied')
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const reasonMsg = e.reason ? (e.reason.message || (typeof e.reason === 'object' ? JSON.stringify(e.reason) : String(e.reason))) : '';
  if (
    reasonMsg.includes('Missing or insufficient permissions') ||
    reasonMsg.includes('permission-denied') ||
    reasonMsg.includes('ResizeObserver')
  ) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
});

// Lock 90% optimal viewing ratio across diverse desktop and laptop DPI densities
function setupDesktopZoomLock() {
  const updateZoom = () => {
    if (typeof window === 'undefined') return;
    const isDesktop = window.innerWidth >= 1024;
    if (!isDesktop) {
      document.documentElement.style.removeProperty('zoom');
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    let targetZoom = 0.90;

    // Compensate for OS-level display scaling (Windows 125%, 150%, 175%) so layout remains crisp and proportional
    if (dpr >= 1.2 && dpr < 1.35) {
      targetZoom = 0.88;
    } else if (dpr >= 1.35 && dpr < 1.7) {
      targetZoom = 0.85;
    } else if (dpr >= 1.7 && dpr < 2.2) {
      targetZoom = 0.90;
    } else if (dpr >= 2.2) {
      targetZoom = 0.92;
    }

    document.documentElement.style.setProperty('--app-desktop-zoom', targetZoom.toString());
    (document.documentElement.style as any).zoom = targetZoom.toString();
  };

  updateZoom();
  window.addEventListener('resize', updateZoom, { passive: true });
  
  // Watch for monitor display changes / DPI shifts
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    try {
      mediaQuery.addEventListener('change', updateZoom);
    } catch (e) {
      try {
        mediaQuery.addListener(updateZoom);
      } catch (_) {}
    }
  }
}

// Async bootstrap initialization before rendering
async function start() {
  setupDesktopZoomLock();
  try {
    await initBootstrap();
  } catch (err) {
    console.warn('[Bootstrap] Background sync warning:', err);
  }

  // Mount application root
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
}

start();

