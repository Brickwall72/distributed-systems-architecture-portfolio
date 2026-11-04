// File: ui-shells/global-shell/src/bootstrap.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@shared/ui-components';
import App from './App';

/*
 * Mount the host shell into the DOM root and enable React strict-mode checks.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
