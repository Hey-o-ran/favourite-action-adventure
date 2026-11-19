import type { MouseEvent } from 'react';
import { SUIT_SYMBOL } from '../cards';
import { useI18n } from '../i18n';
import { ACE, BIG_JOKER, SMALL_JOKER, TWO, type LCard } from '../games/landlordRules';

const FACES: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', [ACE]: 'A', [TWO]: '2' };
export const landlordRankLabel = (rank: number) => FACES[rank] ?? String(rank);

interface Props {
  card: LCard;
  selected?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

/** A card of the 54-card Landlord deck, where the 2 is high and there are two jokers. */
export function LandlordCardView({ card, selected, onClick }: Props) {
  const { t } = useI18n();
  const clickable = onClick !== undefined;
  const joker = card.rank === SMALL_JOKER || card.rank === BIG_JOKER;
  const red = joker ? card.rank === BIG_JOKER : card.suit === 'hearts' || card.suit === 'diamonds';
  const label = joker
    ? t(card.rank === BIG_JOKER ? 'landlord.joker.big' : 'landlord.joker.small')
    : t('card.of', { rank: landlordRankLabel(card.rank), suit: t(`suit.${card.suit!}` as const) });

  return (
    <div
      className={['card', red && 'red', selected && 'selected'].filter(Boolean).join(' ')}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-pressed={clickable ? Boolean(selected) : undefined}
      aria-label={label}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.currentTarget.click();
              }
            }
          : undefined
      }
    >
      <span className="corner">
        {joker ? 'JK' : landlordRankLabel(card.rank)}
        {!joker && (
          <>
            <br />
            {SUIT_SYMBOL[card.suit!]}
          </>
        )}
      </span>
      <span className="pip">{joker ? '★' : SUIT_SYMBOL[card.suit!]}</span>
    </div>
  );
}
