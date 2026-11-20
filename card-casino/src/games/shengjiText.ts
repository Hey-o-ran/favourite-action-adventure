import type { Translate } from '../i18n';

/*
 * The rules engine writes its messages in English. This gives the screen's words for each of them, so the table can be
 * shown in any language. A message that is not recognised is shown as it is.
 */

const SEATS = ['You', 'The left opponent', 'Your partner', 'The right opponent'];

const FIXED: Record<string, Parameters<Translate>[0]> = {
  'The hand is over': 'shengji.msg.handOver',
  'It is not your turn': 'shengji.msg.notYourTurn',
  'Choose some cards to play': 'shengji.msg.chooseSome',
  'Those cards are not in the hand': 'shengji.msg.notInHand',
  'Lead cards from one suit, or all trumps': 'shengji.msg.oneSuit',
  'The throw was beaten, so only its weakest part was played.': 'shengji.msg.throwBeaten',
  'There is no lead to follow': 'shengji.msg.noLead',
  'A card is played twice': 'shengji.msg.twice',
  'You do not hold those cards': 'shengji.msg.notHold',
  'Play exactly 1 card': 'shengji.msg.playOne',
  'You must play all your cards of the led suit': 'shengji.msg.allLed',
  'You must follow the led suit': 'shengji.msg.followSuit',
  'You must play your pairs': 'shengji.msg.pairs',
  'The deal is over': 'shengji.msg.dealOver',
  'Show a level card, a pair of level cards or a pair of jokers': 'shengji.msg.showLevel',
  'That does not beat the declaration already made': 'shengji.msg.notBeat',
  'The deal is not over': 'shengji.msg.dealNotOver',
  'A card is chosen twice': 'shengji.msg.chosenTwice',
  'Those cards are not yours': 'shengji.msg.notYours',
  'Nobody declared, so the kitty names the trump: no trump suit.': 'shengji.msg.kittyNone',
};

const SUIT_KEY = {
  spades: 'shengji.suit.spades',
  hearts: 'shengji.suit.hearts',
  diamonds: 'shengji.suit.diamonds',
  clubs: 'shengji.suit.clubs',
} as const;

const suitWord = (word: string, t: Translate) => (word === 'no trump' ? t('shengji.noTrump') : t(SUIT_KEY[word as keyof typeof SUIT_KEY]));

export function translateEngine(text: string, t: Translate): string {
  const fixed = FIXED[text];
  if (fixed) return t(fixed);

  let m = text.match(/^Play exactly (\d+) cards$/);
  if (m) return t('shengji.msg.playMany', { count: Number(m[1]) });
  m = text.match(/^You must play a tractor of (\d+) pairs$/);
  if (m) return t('shengji.msg.tractor', { count: Number(m[1]) });
  m = text.match(/^Put exactly (\d+) cards back$/);
  if (m) return t('shengji.msg.buryCount', { count: Number(m[1]) });
  m = text.match(/^Nobody declared, so the kitty names the trump: (spades|hearts|diamonds|clubs)\.$/);
  if (m) return t('shengji.msg.kittyNamed', { suit: suitWord(m[1], t) });
  m = text.match(/^(You|The left opponent|Your partner|The right opponent) declares? (no trump|spades|hearts|diamonds|clubs)( with a pair)?\.$/);
  if (m) return t(m[3] ? (`shengji.msg.declarePair.${SEATS.indexOf(m[1])}` as 'shengji.msg.declarePair.0') : (`shengji.msg.declare.${SEATS.indexOf(m[1])}` as 'shengji.msg.declare.0'), { suit: suitWord(m[2], t) });
  return text;
}
