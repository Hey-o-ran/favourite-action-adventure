import type { MouseEvent } from 'react';
import { cardName, type SCard } from '../games/shengjiCards';

const SYMBOL = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' } as const;

interface ShengjiCardViewProps {
  card: SCard;
  selected?: boolean;
  /** Dimmed, for a card that has already been played (shown in the last trick). */
  faded?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

/** A card from the two-deck Shengji pack, which also has jokers. Click it to pick it for a play. */
export function ShengjiCardView({ card, selected, faded, onClick }: ShengjiCardViewProps) {
  const clickable = onClick !== undefined;
  const joker = card.suit === 'joker';
  const red = card.suit === 'hearts' || card.suit === 'diamonds' || (joker && card.rank === 16);
  const label = joker ? (card.rank === 16 ? 'BJ' : 'SJ') : cardName(card).slice(0, -1);
  const symbol = card.suit === 'joker' ? '★' : SYMBOL[card.suit];
  const classes = ['card', 'sj-card', red && 'red', joker && 'joker', selected && 'selected', faded && 'faded'].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      data-id={card.id}
      role={clickable ? 'button' : 'img'}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable ? !!selected : undefined}
      aria-label={joker ? (card.rank === 16 ? 'Big joker' : 'Small joker') : `${label} of ${card.suit}`}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                (e.currentTarget as HTMLElement).click();
              }
            }
          : undefined
      }
    >
      <span className="corner">
        {label}
        <br />
        {symbol}
      </span>
      <span className="pip">{symbol}</span>
    </div>
  );
}
