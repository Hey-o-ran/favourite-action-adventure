import { useEffect, useState } from 'react';
import type { BanDetails } from '../api';
import { useI18n } from '../i18n';
import { formatDuration } from '../statsFormat';

interface BanNoticeProps {
  ban: BanDetails;
  /** Shown while logged in: gives a way to log out. */
  onLogout?: () => void;
  /** Shown once the ban is over, to carry on playing. */
  onRetry?: () => void;
  /** Shown on the login page, to go back and try again later. */
  onBack?: () => void;
}

/**
 * What a banned player sees instead of the casino: the title and description the admin wrote, and how long is left,
 * counting down. When the time is up it says so and lets them carry on.
 */
export function BanNotice({ ban, onLogout, onRetry, onBack }: BanNoticeProps) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const end = Date.parse(ban.until);
  // An unreadable end time is treated as still banned, never as over.
  const left = Number.isNaN(end) ? Infinity : Math.max(0, Math.ceil((end - now) / 1000));

  useEffect(() => {
    if (left <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="login ban-notice">
      <div className="login-card" role="alert">
        <h1>{t('ban.noticeTitle')}</h1>
        <h2 className="ban-title">{ban.title}</h2>
        <p className="ban-description">{ban.description}</p>
        {left === Infinity ? null : left > 0 ? (
          <p className="ban-time" aria-live="polite">
            {t('ban.endsIn', { time: formatDuration(left, t) })}
            <small>{t('ban.endsAt', { date: new Date(end).toLocaleString() })}</small>
          </p>
        ) : (
          <p className="ban-time">{t('ban.over')}</p>
        )}
        {left <= 0 && onRetry && (
          <button className="primary" onClick={onRetry}>
            {t('ban.playAgain')}
          </button>
        )}
        {onBack && (
          <button className={left <= 0 ? 'primary' : undefined} onClick={onBack}>
            {t('ban.backToLogin')}
          </button>
        )}
        {onLogout && <button onClick={onLogout}>{t('menu.logout')}</button>}
      </div>
    </div>
  );
}
