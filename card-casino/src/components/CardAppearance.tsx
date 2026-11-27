import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { CardView } from './CardView';

type Face = 'classic' | 'ivory';
type Back = 'blue' | 'red' | 'green';
const KEY = 'card-casino.card-appearance';
function load(): { face: Face; back: Back } {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { face: value.face === 'ivory' ? 'ivory' : 'classic', back: value.back === 'red' || value.back === 'green' ? value.back : 'blue' };
  } catch { return { face: 'classic', back: 'blue' }; }
}

export function CardAppearance({ visible }: { visible: boolean }) {
  const { t } = useI18n();
  const [appearance, setAppearance] = useState(load);
  useEffect(() => {
    document.documentElement.dataset.cardFace = appearance.face;
    document.documentElement.dataset.cardBack = appearance.back;
    try { localStorage.setItem(KEY, JSON.stringify(appearance)); } catch { /* Choice remains active for this session. */ }
    return () => { delete document.documentElement.dataset.cardFace; delete document.documentElement.dataset.cardBack; };
  }, [appearance]);
  return <section hidden={!visible} className="card-appearance">
    <h2>{t('appearance.title')}</h2>
    <p>{t('appearance.device')}</p>
    <div className="card-appearance-controls">
      <label>{t('appearance.face')} <select value={appearance.face} onChange={e => setAppearance({ ...appearance, face: e.target.value as Face })}>
        <option value="classic">{t('appearance.classic')}</option><option value="ivory">{t('appearance.ivory')}</option>
      </select></label>
      <label>{t('appearance.back')} <select value={appearance.back} onChange={e => setAppearance({ ...appearance, back: e.target.value as Back })}>
        <option value="blue">{t('appearance.blue')}</option><option value="red">{t('appearance.red')}</option><option value="green">{t('appearance.green')}</option>
      </select></label>
    </div>
    <div className="cards card-appearance-preview" aria-label={t('appearance.preview')}><CardView card={{ rank: 1, suit: 'hearts' }} /><CardView faceDown /></div>
  </section>;
}
