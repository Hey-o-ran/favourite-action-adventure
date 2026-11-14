import { useI18n } from '../i18n';

interface BetPanelProps {
  value: number;
  onChange: (value: number) => void;
  /** The most the player can wager right now (their balance). */
  max: number;
  disabled?: boolean;
}

const PRESETS = [10, 25, 50, 100];

export function BetPanel({ value, onChange, max, disabled = false }: BetPanelProps) {
  const { t } = useI18n();
  const clamp = (n: number) => Math.max(1, Math.min(Math.max(max, 1), Math.floor(n) || 1));

  return (
    <div className="bet-panel">
      <label>
        {t('common.bet')}{' '}
        <input
          type="number"
          min={1}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
        />
      </label>
      <div className="chips">
        {PRESETS.map((p) => (
          <button key={p} disabled={disabled || p > max} onClick={() => onChange(p)}>
            {p}
          </button>
        ))}
        <button disabled={disabled || max < 1} onClick={() => onChange(max)}>
          {t('common.max')}
        </button>
      </div>
    </div>
  );
}
