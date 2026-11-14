import type { Card } from '../cards';
import {
  KNOCK_LIMIT,
  arrange,
  deadwoodPoints,
  deadwoodValue,
  discardCard,
  discardable,
  drawFromPile,
  drawFromStock,
  knock,
  mustDrawStock,
  passUpcard,
  takeUpcard,
  topDiscard,
  unseenCards,
  type GinHand,
} from './ginRules';

/*
 * A decent, fair bot. It plays by what it can see: its own cards, the whole discard pile, and which pile cards
 * you picked up. It never looks at your hand or the stock.
 */

/** Gin outs need this many live cards before the bot is willing to wait for gin instead of knocking. */
const WAIT_FOR_GIN_OUTS = 3;
/** Stock sizes below which the bot is happier to knock with more deadwood. */
const KNOCK_LIMIT_EARLY = 4;
const KNOCK_LIMIT_MIDDLE = 7;

interface DiscardChoice {
  index: number;
  /** Deadwood left in the hand after discarding this card. */
  deadwood: number;
  /** How much this card would help you, going by the pile cards you've picked up. Lower is safer. */
  danger: number;
  /** How well the cards left over fit together. Higher is better. */
  potential: number;
}

/** A card helps you if it matches the rank or the suit-and-neighbourhood of a card you picked up. */
function dangerOf(card: Card, took: readonly Card[]): number {
  let danger = 0;
  for (const t of took) {
    if (t.rank === card.rank) danger += 2;
    else if (t.suit === card.suit) {
      const gap = Math.abs(t.rank - card.rank);
      if (gap === 1) danger += 2;
      else if (gap === 2) danger += 1;
    }
  }
  return danger;
}

/** Pairs and near-runs among the loose cards, which could become melds with one more card. */
function potentialOf(loose: readonly Card[]): number {
  let score = 0;
  for (let i = 0; i < loose.length; i++) {
    for (let j = i + 1; j < loose.length; j++) {
      const a = loose[i];
      const b = loose[j];
      if (a.rank === b.rank) score += 2;
      else if (a.suit === b.suit) {
        const gap = Math.abs(a.rank - b.rank);
        if (gap === 1) score += 2;
        else if (gap === 2) score += 1;
      }
    }
  }
  return score;
}

/** Every legal discard from an 11-card hand, best first. */
function rankDiscards(h: GinHand, hand: readonly Card[]): DiscardChoice[] {
  const choices = discardable(h, hand).map((index) => {
    const rest = hand.filter((_, i) => i !== index);
    const arranged = arrange(rest);
    return {
      index,
      deadwood: arranged.points,
      danger: dangerOf(hand[index], h.playerTook),
      potential: potentialOf(arranged.deadwood),
    };
  });
  return choices.sort(
    (a, b) =>
      a.deadwood - b.deadwood ||
      a.danger - b.danger ||
      b.potential - a.potential ||
      deadwoodValue(hand[b.index]) - deadwoodValue(hand[a.index]),
  );
}

/** Would the card join a set or run if the bot picked it up? The bot only takes pile cards that build a meld. */
function joinsAMeld(h: GinHand, card: Card): boolean {
  const arranged = arrange([...h.bot, card]);
  return arranged.melds.some((meld) => meld.some((c) => c.rank === card.rank && c.suit === card.suit));
}

/** Unseen cards that would give gin if drawn next, from a 10-card hand. */
function ginOuts(h: GinHand, hand: readonly Card[]): number {
  let outs = 0;
  for (const card of unseenCards(h, hand)) {
    const eleven = [...hand, card];
    if (eleven.some((_, i) => deadwoodPoints(eleven.filter((__, k) => k !== i)) === 0)) outs++;
  }
  return outs;
}

/** How much deadwood the bot is willing to knock with, depending on how far through the stock the hand is. */
const knockLimit = (h: GinHand) => (h.stock.length > 20 ? KNOCK_LIMIT_EARLY : h.stock.length > 12 ? KNOCK_LIMIT_MIDDLE : KNOCK_LIMIT);

/** Does the bot knock after its best discard? Gin always. Otherwise only with little deadwood, and not if gin is likely. */
function shouldKnock(h: GinHand, best: DiscardChoice): boolean {
  if (best.deadwood === 0) return true;
  if (best.deadwood > Math.min(KNOCK_LIMIT, knockLimit(h))) return false;
  const rest = h.bot.filter((_, i) => i !== best.index);
  const arranged = arrange(rest);
  // With one loose card left, a single lucky draw makes gin. Wait for it while there are plenty of chances.
  if (arranged.deadwood.length === 1 && h.stock.length > 8 && ginOuts(h, rest) >= WAIT_FOR_GIN_OUTS) return false;
  return true;
}

/** Plays one step for the bot: a decision on the first card, a draw, or a discard (which may be a knock). */
export function botStep(h: GinHand): GinHand {
  if (h.turn !== 'bot') return h;

  if (h.phase === 'offer') {
    return joinsAMeld(h, topDiscard(h)) ? takeUpcard(h) : passUpcard(h);
  }

  if (h.phase === 'draw') {
    if (!mustDrawStock(h) && joinsAMeld(h, topDiscard(h))) return drawFromPile(h);
    return drawFromStock(h);
  }

  if (h.phase === 'discard') {
    const best = rankDiscards(h, h.bot)[0];
    return shouldKnock(h, best) ? knock(h, best.index) : discardCard(h, best.index);
  }
  return h;
}
