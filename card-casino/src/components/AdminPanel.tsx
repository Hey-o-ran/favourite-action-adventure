import { useI18n } from '../i18n';
import { AdminAbuse } from './AdminAbuse';
import { AdminCoins } from './AdminCoins';
import { AdminLog } from './AdminLog';

/** The admin tools: find a player to give or take coins or ban them, start events, and read the player log. Admins only. */
export function AdminPanel() {
  const { t } = useI18n();
  return (
    <section className="admin-panel">
      <h2>{t('admin.title')}</h2>
      <p className="hint">{t('admin.hint')}</p>
      <AdminCoins />
      <AdminAbuse />
      <AdminLog />
    </section>
  );
}
