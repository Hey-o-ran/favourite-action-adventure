import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { WalletProvider } from './wallet';
import { PasswordGate } from './components/PasswordGate';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PasswordGate>
      <WalletProvider>
        <App />
      </WalletProvider>
    </PasswordGate>
  </StrictMode>,
);
