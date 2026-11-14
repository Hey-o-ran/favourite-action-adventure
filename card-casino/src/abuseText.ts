import type { AbuseEvent } from './api';
import type { Language, Translate } from './i18n';

/**
 * The title and message to show for an admin event. The server writes them in English, so in English they are
 * shown as they come; in another language they are worded again from the kind of event and its amount.
 */
export function eventWords(event: Pick<AbuseEvent, 'type' | 'title' | 'message' | 'amount'>, lang: Language, t: Translate) {
  if (lang === 'en-GB') return { title: event.title, message: event.message };
  return {
    title: t('announce.eventTitle'),
    message:
      event.type === 'FREE_COINS' ? t('announce.freeCoins', { amount: event.amount ?? 0 }) : t('announce.unloseable'),
  };
}
