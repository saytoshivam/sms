import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './lib/auth';
import { BrandingProvider } from './lib/branding';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrandingProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </BrandingProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
