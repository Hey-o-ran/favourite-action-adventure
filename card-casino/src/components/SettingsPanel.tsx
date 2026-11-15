import { useI18n } from '../i18n';
import type { SettingValue, SettingValues, SettingsSchema } from '../gameSettings';

interface SettingsPanelProps {
  schema: SettingsSchema;
  values: SettingValues;
  onChange: (id: string, value: SettingValue) => void;
  onReset: () => void;
}

/** The options for a game, laid out from its settings description. The same panel serves every game. */
export function SettingsPanel({ schema, values, onChange, onReset }: SettingsPanelProps) {
  const { t } = useI18n();

  return (
    <div className="settings" role="group" aria-label={t('settings.show')}>
      {schema.groups.map((group) => (
        <section key={group.title} className="settings-group">
          <h3>{t(group.title)}</h3>
          {group.settings.map((setting) =>
            setting.kind === 'toggle' ? (
              <label key={setting.id} className="setting-toggle">
                <input type="checkbox" checked={values[setting.id] === true} onChange={(e) => onChange(setting.id, e.target.checked)} />
                <span>
                  {t(setting.label)}
                  {setting.help && <small>{t(setting.help)}</small>}
                </span>
              </label>
            ) : (
              <fieldset key={setting.id} className="setting-choice">
                <legend>{t(setting.label)}</legend>
                {setting.help && <small className="setting-help">{t(setting.help)}</small>}
                {setting.options.map((option) => (
                  <label key={option.value} className="setting-option">
                    <input
                      type="radio"
                      name={`${schema.gameId}-${setting.id}`}
                      value={option.value}
                      checked={values[setting.id] === option.value}
                      onChange={() => onChange(setting.id, option.value)}
                    />
                    <span>
                      {t(option.label)}
                      {option.help && <small>{t(option.help)}</small>}
                    </span>
                  </label>
                ))}
              </fieldset>
            ),
          )}
        </section>
      ))}
      <p className="settings-foot">
        <span>{t('settings.note')}</span>
        <button onClick={onReset}>{t('settings.reset')}</button>
      </p>
    </div>
  );
}
