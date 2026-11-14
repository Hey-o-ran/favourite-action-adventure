import { CONFLICT_NOTICE, RESET_NOTICE } from '../balanceSync';
import { useI18n, type MessageKey } from '../i18n';
import { useWallet } from '../wallet';

/** The wallet's notices are English sentences; these are the translated versions of the ones it can produce. */
const NOTICE_KEYS: Record<string, MessageKey> = {
  [CONFLICT_NOTICE]: 'save.conflict',
  [RESET_NOTICE]: 'save.reset',
};

/** Tells the player when their coins are not safely saved, or when the server corrected them. */
export function SaveStatus() {
  const { status, notice, dismissNotice } = useWallet();
  const { t } = useI18n();
  return (
    <>
      {status === 'failed' && (
        <p role="status" className="save-status">
          {t('save.failed')}
        </p>
      )}
      {notice && (
        <div role="status" className="banner">
          {NOTICE_KEYS[notice] ? t(NOTICE_KEYS[notice]) : notice}{' '}
          <button onClick={dismissNotice} aria-label={t('save.dismiss')}>
            {t('save.dismiss')}
          </button>
        </div>
      )}
    </>
  );
}
