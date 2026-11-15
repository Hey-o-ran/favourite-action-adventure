import type { Language, Translate } from '../i18n';

/*
 * The game engines write their "what just happened" lines in English, and their tests check those exact words.
 * These turn such a line into the chosen language for the screen. In British English the line is shown as it is.
 * A line that is not recognised is also shown as it is, so a new message can never go missing.
 *
 * Every pattern below is covered by a test that plays real games and checks no English is left in Chinese, so a
 * message changed in an engine without changing it here is caught.
 */

const cards = (t: Translate, n: string) => t(Number(n) === 1 ? 'count.cardOne' : 'count.cardMany', { count: n });

type Rule = [RegExp, (m: RegExpMatchArray, t: Translate) => string];

function apply(rules: Rule[], line: string, t: Translate): string | undefined {
  for (const [pattern, text] of rules) {
    const m = line.match(pattern);
    if (m) return text(m, t);
  }
  return undefined;
}

const CRAZY: Rule[] = [
  [/^Your turn\.$/, (_, t) => t('crazy.log.yourTurn')],
  [/^You played (\S+) and chose (\S)\.$/, (m, t) => t('crazy.log.playedEight', { card: m[1], suit: m[2] })],
  [/^You played (\S+)\.$/, (m, t) => t('crazy.log.played', { card: m[1] })],
  [/^You drew (\d+) cards? but still can't play\. You pass\.$/, (m, t) => t('crazy.log.drewStuck', { cards: cards(t, m[1]) })],
  [/^You drew (\d+) cards?\.$/, (m, t) => t('crazy.log.drew', { cards: cards(t, m[1]) })],
  [/^Nothing left to draw\. You pass\.$/, (_, t) => t('crazy.log.nothing')],
  [/^Bot passes\.$/, (_, t) => t('crazy.log.botPasses')],
  [/^Bot drew (\d+) cards? and can't play\. It passes\.$/, (m, t) => t('crazy.log.botDrewPasses', { cards: cards(t, m[1]) })],
  [
    /^Bot drew (\d+) cards? and played (\S+) and chose (\S)\.$/,
    (m, t) => t('crazy.log.botDrewPlayedEight', { cards: cards(t, m[1]), card: m[2], suit: m[3] }),
  ],
  [/^Bot drew (\d+) cards? and played (\S+)\.$/, (m, t) => t('crazy.log.botDrewPlayed', { cards: cards(t, m[1]), card: m[2] })],
  [/^Bot played (\S+) and chose (\S)\.$/, (m, t) => t('crazy.log.botPlayedEight', { card: m[1], suit: m[2] })],
  [/^Bot played (\S+)\.$/, (m, t) => t('crazy.log.botPlayed', { card: m[1] })],
];

/** The Crazy Eights log line in the chosen language. */
export function crazyEightsLog(line: string, lang: Language, t: Translate): string {
  return lang === 'en-GB' ? line : (apply(CRAZY, line, t) ?? line);
}

const who = (t: Translate, name: string) => t(name === 'You' ? 'gin.who.you' : 'gin.who.bot');

/** Whole lines that contain more than one sentence but mean one thing. */
const GIN_WHOLE: Rule[] = [
  [
    /^(You are|Bot is) first to act\. The (\S+) is turned up\.$/,
    (m, t) => t('gin.log.firstToAct', { who: t(m[1] === 'You are' ? 'gin.log.firstYou' : 'gin.log.firstBot'), card: m[2] }),
  ],
];

/** One sentence at a time. A line may hold several ("... Nobody wanted it."). */
const GIN_SENTENCE: Rule[] = [
  [/^(You|Bot) passed on the (\S+)\.$/, (m, t) => t('gin.log.passed', { who: who(t, m[1]), card: m[2] })],
  [/^Nobody wanted it\.$/, (_, t) => t('gin.log.nobody')],
  [/^(You|Bot) took the (\S+) from the pile\.$/, (m, t) => t('gin.log.tookPile', { who: who(t, m[1]), card: m[2] })],
  [/^(You|Bot) took the (\S+)\.$/, (m, t) => t('gin.log.took', { who: who(t, m[1]), card: m[2] })],
  [/^(You|Bot) drew from the stock\.$/, (m, t) => t('gin.log.drewStock', { who: who(t, m[1]) })],
  [/^(You|Bot) discarded the (\S+)\.$/, (m, t) => t('gin.log.discarded', { who: who(t, m[1]), card: m[2] })],
  [/^Only (\d+) cards are left in the stock, so the hand is a draw\.$/, (m, t) => t('gin.log.drawn', { count: m[1] })],
  [/^(You|Bot) went gin!$/, (m, t) => t('gin.log.gin', { who: who(t, m[1]) })],
  [/^(You|Bot) knocked with (\d+)\.$/, (m, t) => t('gin.log.knocked', { who: who(t, m[1]), points: m[2] })],
];

/** The Gin Rummy log line in the chosen language. */
export function ginLog(line: string, lang: Language, t: Translate): string {
  if (lang === 'en-GB') return line;
  const whole = apply(GIN_WHOLE, line, t);
  if (whole !== undefined) return whole;
  return line
    .split(/(?<=[.!]) (?=[A-Z])/)
    .map((sentence) => apply(GIN_SENTENCE, sentence, t) ?? sentence)
    .join(' ');
}
