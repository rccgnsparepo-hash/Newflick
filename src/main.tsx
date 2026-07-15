import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { initBootstrap } from './lib/bootstrap';

// Prevent ResizeObserver loop limit exceeded error from bubbling up as a fatal error
window.addEventListener('error', (e) => {
  if (e.message && (
    e.message.includes('ResizeObserver loop completed') ||
    e.message.includes('ResizeObserver loop limit')
  )) {
    e.stopImmediatePropagation();
    e.preventDefault();
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
