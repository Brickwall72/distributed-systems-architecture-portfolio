// File: ui-shells/global-shell/src/bootstrap.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/*
 * Mount the host shell into the DOM root and enable React strict-mode checks.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
