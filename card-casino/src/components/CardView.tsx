import type { MouseEvent } from 'react';
import { SUIT_SYMBOL, isRed, rankLabel, type Card } from '../cards';
import { useI18n } from '../i18n';

interface CardViewProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

export function CardView({ card, faceDown, selected, onClick }: CardViewProps) {
  const { t } = useI18n();
  const clickable = onClick !== undefined;

  if (!card || faceDown) {
    return (
      <div
        className={`card back${selected ? ' selected' : ''}`}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={onClick}
        aria-label={t('card.faceDown')}
      />
    );
  }

  const classes = ['card', isRed(card) && 'red', selected && 'selected'].filter(Boolean).join(' ');
  return (
    <div
      className={classes}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      aria-label={t('card.of', { rank: rankLabel(card.rank), suit: t(`suit.${card.suit}`) })}
    >
      <span className="corner">
        {rankLabel(card.rank)}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="pip">{SUIT_SYMBOL[card.suit]}</span>
    </div>
  );
}
