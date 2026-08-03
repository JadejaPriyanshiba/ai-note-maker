import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/AuthContext.tsx';
import { GenerationProvider } from './lib/GenerationContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <GenerationProvider>
        <App />
      </GenerationProvider>
    </AuthProvider>
  </StrictMode>,
);

