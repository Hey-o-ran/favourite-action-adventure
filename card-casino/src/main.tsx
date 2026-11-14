import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { WalletProvider } from './wallet';
import { AbuseEventsProvider } from './abuseEvents';
import { CoinNoticesProvider } from './coinNotices';
import { AuthGate } from './components/AuthGate';
import { LanguageProvider } from './i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthGate>
        <WalletProvider>
          <AbuseEventsProvider>
            <CoinNoticesProvider>
              <App />
            </CoinNoticesProvider>
          </AbuseEventsProvider>
        </WalletProvider>
      </AuthGate>
    </LanguageProvider>
  </StrictMode>,
);
