import { useState } from 'react';
import { isLive } from '../abuse';
import { useAbuseEvents, type EventOutcome } from '../abuseEvents';
import type { AbuseEvent } from '../api';

/** What the event did for this player, once it has been claimed. */
function outcomeText(event: AbuseEvent, outcome: EventOutcome | undefined): string {
  if (outcome === 'coins') return `+${(event.amount ?? 0).toLocaleString('en-US')} coins are in your balance.`;
  if (outcome === 'protected') return "You're protected: your next game can't cost you coins.";
  if (outcome === 'already') return 'You already took this one.';
  return '';
}

/** The announcements at the very top of the screen: events that are on, plus any protection you are carrying. */
export function AnnouncementBar() {
  const { events, outcomes, protectedNext, lastSaved, dismissSaved } = useAbuseEvents();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const shown = events.filter((e) => isLive(e) && !dismissed.has(e.eventId));
  if (shown.length === 0 && !protectedNext && lastSaved === null) return null;

  return (
    <div className="abuse-bars">
      {shown.map((event) => (
        <div key={event.eventId} className="abuse-bar" role="status">
          <span className="abuse-title">{event.title}</span>
          <span className="abuse-message">{event.message}</span>
          <span className="abuse-outcome">{outcomeText(event, outcomes[event.eventId])}</span>
          <button
            className="abuse-dismiss"
            onClick={() => setDismissed(new Set([...dismissed, event.eventId]))}
            aria-label={`Dismiss: ${event.message}`}
          >
            ×
          </button>
        </div>
      ))}

      {protectedNext && (
        <div className="abuse-bar shield" role="status">
          <span className="abuse-title">PROTECTED</span>
          <span className="abuse-message">Your next game is unloseable. It can't cost you any coins.</span>
        </div>
      )}

      {lastSaved !== null && (
        <div className="abuse-bar saved" role="status">
          <span className="abuse-title">SAVED</span>
          <span className="abuse-message">Unloseable! You got {lastSaved.toLocaleString('en-US')} coins back.</span>
          <button className="abuse-dismiss" onClick={dismissSaved} aria-label="Dismiss: coins saved">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
