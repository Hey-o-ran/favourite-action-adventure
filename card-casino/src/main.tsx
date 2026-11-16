import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { WalletProvider } from './wallet';
import { AbuseEventsProvider } from './abuseEvents';
import { CoinNoticesProvider } from './coinNotices';
import { WinAnnouncementsProvider } from './winAnnouncements';
import { AuthGate } from './components/AuthGate';
import { SiteFooter } from './components/SiteFooter';
import { LanguageProvider } from './i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <AuthGate>
        <WalletProvider>
          <AbuseEventsProvider>
            <CoinNoticesProvider>
              <WinAnnouncementsProvider>
                <App />
              </WinAnnouncementsProvider>
            </CoinNoticesProvider>
          </AbuseEventsProvider>
        </WalletProvider>
      </AuthGate>
      <SiteFooter />
    </LanguageProvider>
  </StrictMode>,
);
