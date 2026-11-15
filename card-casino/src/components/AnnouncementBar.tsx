import { useState } from 'react';
import { isLive } from '../abuse';
import { useAbuseEvents, type EventOutcome } from '../abuseEvents';
import { eventWords } from '../abuseText';
import { useCoinNotices } from '../coinNotices';
import { useI18n, type Translate } from '../i18n';
import type { AbuseEvent } from '../api';
import { VerifiedBadge } from './VerifiedBadge';

/** What the event did for this player, once it has been claimed. */
function outcomeText(event: AbuseEvent, outcome: EventOutcome | undefined, t: Translate): string {
  if (outcome === 'coins') return t('announce.outcomeCoins', { amount: event.amount ?? 0 });
  if (outcome === 'protected') return t('announce.outcomeProtected');
  if (outcome === 'already') return t('announce.outcomeAlready');
  return '';
}

/** The announcements at the very top of the screen: events that are on, plus any protection you are carrying. */
export function AnnouncementBar() {
  const { events, outcomes, protectedNext, lastSaved, dismissSaved } = useAbuseEvents();
  const { notices, dismiss: dismissNotice } = useCoinNotices();
  const { t, tx, lang } = useI18n();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const shown = events.filter((e) => isLive(e) && !dismissed.has(e.eventId));
  if (shown.length === 0 && !protectedNext && lastSaved === null && notices.length === 0) return null;

  return (
    <div className="abuse-bars">
      {notices.map((n) => {
        const sent = n.amount >= 0;
        const text = sent
          ? t('announce.sentText', { amount: n.amount, name: n.senderDisplayName })
          : t('announce.removedText', { amount: Math.abs(n.amount), name: n.senderDisplayName });
        return (
          <div key={n.noticeId} className={`abuse-bar ${sent ? 'saved' : 'removed'}`} role="status">
            <span className="abuse-title">{sent ? t('announce.coinsSent') : t('announce.coinsRemoved')}</span>
            <span className="abuse-message">{text}</span>
            <button className="abuse-dismiss" onClick={() => dismissNotice(n.noticeId)} aria-label={t('announce.dismiss', { text })}>
              ×
            </button>
          </div>
        );
      })}

      {shown.map((event) => {
        const words = eventWords(event, lang, t);
        return (
          <div key={event.eventId} className="abuse-bar" role="status">
            <span className="abuse-title">{words.title}</span>
            <span className="abuse-message">{words.message}</span>
            {event.announcedBy && (
              <span className="abuse-from">
                {tx('announce.from', { name: <b>{event.announcedBy.displayName}</b> })}
                {event.announcedBy.verified && <VerifiedBadge />}
              </span>
            )}
            <span className="abuse-outcome">{outcomeText(event, outcomes[event.eventId], t)}</span>
            <button
              className="abuse-dismiss"
              onClick={() => setDismissed(new Set([...dismissed, event.eventId]))}
              aria-label={t('announce.dismiss', { text: words.message })}
            >
              ×
            </button>
          </div>
        );
      })}

      {protectedNext && (
        <div className="abuse-bar shield" role="status">
          <span className="abuse-title">{t('announce.protectedTitle')}</span>
          <span className="abuse-message">{t('announce.protectedText')}</span>
        </div>
      )}

      {lastSaved !== null && (
        <div className="abuse-bar saved" role="status">
          <span className="abuse-title">{t('announce.savedTitle')}</span>
          <span className="abuse-message">{t('announce.savedText', { amount: lastSaved })}</span>
          <button className="abuse-dismiss" onClick={dismissSaved} aria-label={t('announce.savedDismiss')}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
