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

import { ErrorBoundary } from './components/ErrorBoundary';

// Mount application root immediately to prevent any blank/white screen delays
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// Background sync bootstrap
initBootstrap().catch((err) => {
  console.warn('[Bootstrap] Background sync warning:', err);
});

