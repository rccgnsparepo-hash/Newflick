import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { initBootstrap } from './lib/bootstrap';



const originalConsoleError = console.error;
console.error = function(...args) {
  const msg = args.map(arg => arg instanceof Error ? arg.message : typeof arg === 'object' && arg !== null ? JSON.stringify(arg) : String(arg)).join(' ');
  if (msg.includes('Missing or insufficient permissions') || msg.includes('ResizeObserver')) {
    return;
  }
  originalConsoleError.apply(console, args);
};


// Prevent ResizeObserver loop limit exceeded error from bubbling up as a fatal error
window.addEventListener('error', (e) => {
  if (e.message && (
    e.message.includes('ResizeObserver loop completed') ||
    e.message.includes('ResizeObserver loop limit') ||
    e.message.includes('Missing or insufficient permissions')
  )) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message && e.reason.message.includes('Missing or insufficient permissions')) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
});

// Initialize bootstrap configuration before loading the App
// This ensures environment variables are fetched dynamically (e.g., for Electron)
initBootstrap().then(() => {
  import('./App.tsx').then(({ default: App }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
});
