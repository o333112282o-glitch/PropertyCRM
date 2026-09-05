import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for PWA push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Handle deep-link from service worker postMessage (push notification click on existing window)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'open-lead-detail' && event.data?.leadId) {
      window.dispatchEvent(new CustomEvent('open-lead-detail', { detail: event.data.leadId }));
    }
  });
}

// Handle deep-link from URL hash (new window opened with #lead=<id>)
if (window.location.hash.startsWith('#lead=')) {
  const leadId = window.location.hash.slice(6);
  if (leadId) {
    window.dispatchEvent(new CustomEvent('open-lead-detail', { detail: leadId }));
    history.replaceState(null, '', window.location.pathname);
  }
}
