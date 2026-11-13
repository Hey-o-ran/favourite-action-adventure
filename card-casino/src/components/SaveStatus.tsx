import { useWallet } from '../wallet';

/** Tells the player when their coins are not safely saved, or when the server corrected them. */
export function SaveStatus() {
  const { status, notice, dismissNotice } = useWallet();
  return (
    <>
      {status === 'failed' && (
        <p role="status" className="save-status">
          Not saved yet. Retrying…
        </p>
      )}
      {notice && (
        <div role="status" className="banner">
          {notice}{' '}
          <button onClick={dismissNotice} aria-label="Dismiss">
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
