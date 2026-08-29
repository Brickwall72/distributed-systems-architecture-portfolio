// File: services/core/topology-service/client/src/bootstrap.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * The application mount target used by the topology client shell.
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Fatal Application Error: #root not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
