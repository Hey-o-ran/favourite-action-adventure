import { useEffect, useState, type ReactNode } from 'react';
import { setBannedHandler, type BanDetails } from '../api';
import { useSession } from '../session';
import { BanNotice } from './BanNotice';

/**
 * Sits inside the login. If the server ever turns the player away for being banned, whatever they were doing, the casino is
 * replaced by the ban notice. When the ban is over they can carry on, and everything loads again from the start.
 */
export function BanGate({ children }: { children: ReactNode }) {
  const { logout } = useSession();
  const [ban, setBan] = useState<BanDetails | null>(null);

  useEffect(() => {
    setBannedHandler(setBan);
    return () => setBannedHandler(null);
  }, []);

  if (ban) return <BanNotice ban={ban} onLogout={logout} onRetry={() => setBan(null)} />;
  return <>{children}</>;
}
