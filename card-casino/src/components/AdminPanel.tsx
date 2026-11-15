import { useCallback, useEffect, useState } from 'react';
import { ApiError, approveUser, listPendingUsers, type PendingUser } from '../api';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import { AdminAbuse } from './AdminAbuse';
import { AdminCoins } from './AdminCoins';

/** Lists accounts waiting for approval, with a button to approve each one. Admins only. */
export function AdminPanel() {
  const { session, logout } = useSession();
  const { t } = useI18n();
  const [users, setUsers] = useState<PendingUser[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [approving, setApproving] = useState<string>();
  const [approveError, setApproveError] = useState<string>();

  // An expired or rejected token means the player must log in again.
  const handleFailure = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return true;
      }
      return false;
    },
    [logout],
  );

  useEffect(() => {
    let cancelled = false;
    listPendingUsers(session.idToken)
      .then((res) => {
        if (!cancelled) setUsers(res.users);
      })
      .catch((err) => {
        if (cancelled || handleFailure(err)) return;
        setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [session.idToken, handleFailure]);

  async function approve(user: PendingUser) {
    setApproveError(undefined);
    setApproving(user.userId);
    try {
      await approveUser(session.idToken, user.userId);
      setUsers((list) => (list ?? []).filter((u) => u.userId !== user.userId));
    } catch (err) {
      if (!handleFailure(err)) setApproveError(t('admin.approveError', { name: user.displayName }));
    } finally {
      setApproving(undefined);
    }
  }

  return (
    <section className="admin-panel">
      <h2>{t('admin.title')}</h2>
      <p className="hint">{t('admin.hint')}</p>

      {loadError && (
        <p role="alert" className="login-error">
          {t('admin.loadError')}
        </p>
      )}
      {approveError && (
        <p role="alert" className="login-error">
          {approveError}
        </p>
      )}

      {users === null && !loadError && <p className="hint">{t('common.loading')}</p>}
      {users?.length === 0 && <p className="hint">{t('admin.none')}</p>}

      {users && users.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('register.displayName')}</th>
              <th>{t('login.email')}</th>
              <th>{t('admin.requested')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId}>
                <td>{u.displayName}</td>
                <td>{u.email}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <button
                    className="primary"
                    onClick={() => approve(u)}
                    disabled={approving !== undefined}
                    aria-label={t('admin.approveName', { name: u.displayName })}
                  >
                    {t('admin.approve')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <AdminCoins />
      <AdminAbuse />
    </section>
  );
}
