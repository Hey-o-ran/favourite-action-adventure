import { createContext, useContext, useEffect, useState } from 'react';
import { ApiError, getPlayerProfile, type PlayerProfileData } from '../api';
import { useI18n } from '../i18n';
import { useSession } from '../session';

export const OpenPlayerProfile = createContext<((userId: string) => void) | null>(null);

export function PlayerName({ userId, name }: { userId?: string; name: string }) {
  const open = useContext(OpenPlayerProfile);
  return userId && open
    ? <button type="button" className="profile-name" onClick={() => open(userId)}>{name}</button>
    : <>{name}</>;
}

export function PlayerProfile({ userId, onBack }: { userId: string; onBack: () => void }) {
  const { session, logout } = useSession();
  const { lang, t } = useI18n();
  const [profile, setProfile] = useState<PlayerProfileData>();
  const [error, setError] = useState<'profile.notFound' | 'profile.failed'>();

  useEffect(() => {
    let current = true;
    getPlayerProfile(session.idToken, userId).then((data) => {
      if (current) setProfile(data);
    }).catch((reason: unknown) => {
      if (!current) return;
      if (reason instanceof ApiError && reason.status === 401) {
        logout();
        return;
      }
      setError(reason instanceof ApiError && reason.status === 404 ? 'profile.notFound' : 'profile.failed');
    });
    return () => { current = false; };
  }, [session.idToken, userId, logout]);

  const date = new Intl.DateTimeFormat(lang, { dateStyle: 'long' });
  const relative = new Intl.RelativeTimeFormat(lang, { numeric: 'always' });
  const lastSeen = (value: string | null) => {
    const timestamp = value === null ? NaN : Date.parse(value);
    if (!Number.isFinite(timestamp)) return t('profile.unknown');
    const minutes = Math.floor((Date.now() - timestamp) / 60_000);
    if (minutes < 5) return t('profile.online');
    if (minutes < 60) return relative.format(-minutes, 'minute');
    if (minutes < 1_440) return relative.format(-Math.floor(minutes / 60), 'hour');
    if (minutes < 10_080) return relative.format(-Math.floor(minutes / 1_440), 'day');
    return date.format(timestamp);
  };

  return (
    <main className="app player-profile">
      <button type="button" autoFocus onClick={onBack}>{t('profile.back')}</button>
      <h1>{profile?.displayName ?? t('profile.title')}</h1>
      {error && <p role="alert">{t(error)}</p>}
      {!error && !profile && <p role="status">{t('profile.loading')}</p>}
      {profile && (
        <dl>
          <dt>{t('profile.memberSince')}</dt>
          <dd>{date.format(Date.parse(profile.createdAt))}</dd>
          <dt>{t('profile.lastOnline')}</dt>
          <dd>{lastSeen(profile.lastSeenAt)}</dd>
        </dl>
      )}
    </main>
  );
}
