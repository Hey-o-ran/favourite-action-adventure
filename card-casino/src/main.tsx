import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { WalletProvider } from './wallet';
import { AuthGate } from './components/AuthGate';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <WalletProvider>
        <App />
      </WalletProvider>
    </AuthGate>
  </StrictMode>,
);
