import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
