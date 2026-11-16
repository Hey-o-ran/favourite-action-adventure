import { useI18n } from '../i18n';

/** The credit shown at the very bottom of every page. */
export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <p>{t('footer.credit')}</p>
    </footer>
  );
}
