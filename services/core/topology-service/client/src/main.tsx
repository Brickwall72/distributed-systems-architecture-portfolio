// File: services/core/topology-service/client/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { TopologyCanvas } from './TopologyCanvas.js';

// If you have a global Tailwind CSS entry point sheet (like an index.css or main.css), import it here:
// import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Fatal Application Error: The target HTML element root was not found in the DOM matrix.');
}

// Bootstrap the concurrent React rendering pipeline engine natively
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <TopologyCanvas />
  </React.StrictMode>
);
