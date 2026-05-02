declare global {
  interface Window {
    __mtStage?: (s: string) => void;
  }
}
window.__mtStage?.('main.tsx-imports-resolved');

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

window.__mtStage?.('main.tsx-rendering');
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
window.__mtStage?.('main.tsx-render-called');
queueMicrotask(() => {
  window.__mtStage?.('after-render-microtask');
  setTimeout(() => {
    window.__mtStage?.('after-render-100ms');
    const m = document.getElementById('mt-bootstrap-marker');
    if (m) m.style.display = 'none';
  }, 100);
});
