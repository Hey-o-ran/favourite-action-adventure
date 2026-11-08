import type { MouseEvent } from 'react';
import { SUIT_SYMBOL, isRed, rankLabel, type Card } from '../cards';

interface CardViewProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

export function CardView({ card, faceDown, selected, onClick }: CardViewProps) {
  const clickable = onClick !== undefined;

  if (!card || faceDown) {
    return (
      <div
        className={`card back${selected ? ' selected' : ''}`}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={onClick}
        aria-label="Face-down card"
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
      aria-label={`${rankLabel(card.rank)} of ${card.suit}`}
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
