import type { ReactNode } from 'react';
import { GameNav, type NavGame } from './GameNav';
import type { Filters, SortOrder } from '../gameFilters';
import { handText, useI18n, type MessageKey } from '../i18n';
import { HAND_SIZE, WIN_PAYOUT } from '../games/crazyEightsRules';
import { BIG_BLIND, BUY_IN, MAX_RAISES, SMALL_BLIND, betSize } from '../games/holdemRules';
import { HIT_RATE, RETURN_TO_PLAYER, THREE_OF_A_KIND, TWO_CHERRIES } from '../games/slotsRules';
import { GlaggleAt, GlaggleRow } from './GlaggleFace';
import { CHIPS, evenMoneySpot, payoutOdds, columnSpot, cornerSpot, sixLineSpot, splitSpot, straightSpot, streetSpot } from '../games/rouletteRules';
import { GIN_BONUS, HAND_BONUS, HAND_SIZE as GIN_HAND_SIZE, KNOCK_LIMIT, MATCH_BONUS, MATCH_TARGET, PAYOUT_BY_DIFFICULTY as GIN_PAYOUT, STOCK_FLOOR, UNDERCUT_BONUS } from '../games/ginRules';
import { CATEGORY_NAMES } from '../games/pokerHands';
import { PAYTABLE } from '../games/videoPokerRules';
import { JACKPOT_MULTIPLIER, POT_MULTIPLIER } from '../games/higherLowerRules';
import { SPREAD_PAYOUTS, THREE_OF_A_KIND_PAYOUT, WIDE_SPREAD_PAYOUT } from '../games/redDogRules';
import { BANKER_PAYOUT_PERCENT, PLAYER_PAYOUT, TIE_PAYOUT } from '../games/baccaratRules';

/** The numbers from the game rules go into the text as plain strings, so they are never given thousands commas. */
const s = (n: number) => String(n);

/** A small card for diagrams. `back` draws a face-down card. */
function MiniCard({ x, y, label, red, back }: { x: number; y: number; label?: string; red?: boolean; back?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="38" height="54" rx="5" fill={back ? '#1e3a8a' : '#fff'} stroke="#0f172a" strokeWidth="1.5" />
      {back ? (
        <rect x="5" y="5" width="28" height="44" rx="3" fill="none" stroke="#93c5fd" strokeWidth="1.5" />
      ) : (
        <text x="19" y="34" textAnchor="middle" fontSize="17" fontWeight="700" fill={red ? '#dc2626' : '#0f172a'}>
          {label}
        </text>
      )}
    </g>
  );
}

const Note = ({ x, y, children, anchor = 'middle' }: { x: number; y: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) => (
  <text x={x} y={y} textAnchor={anchor} fontSize="12" fill="#f8fafc">
    {children}
  </text>
);

/** The keys `<prefix>.1`, `<prefix>.2` ... `<prefix>.<count>` in the dictionary. */
const keys = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}.${i + 1}` as MessageKey);

/** A bullet list of texts with **bold** parts. */
function Items({ prefix, count, values }: { prefix: string; count: number; values?: Record<string, string> }) {
  const { tb } = useI18n();
  return (
    <ul>
      {keys(prefix, count).map((key) => (
        <li key={key}>{tb(key, values)}</li>
      ))}
    </ul>
  );
}

function BlackjackDiagram() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 420 150" role="img" aria-label={t('diagram.blackjack.label')}>
      <Note x={10} y={16} anchor="start">{t('diagram.blackjack.yourHand')}</Note>
      <MiniCard x={10} y={26} label="K♠" />
      <MiniCard x={54} y={26} label="7♥" red />
      <Note x={72} y={102}>{t('diagram.blackjack.sum')}</Note>
      <text x="170" y="62" fontSize="22" fill="#f5c542">{t('diagram.blackjack.vs')}</text>
      <Note x={230} y={16} anchor="start">{t('diagram.blackjack.dealer')}</Note>
      <MiniCard x={230} y={26} label="6♦" red />
      <MiniCard x={274} y={26} back />
      <Note x={300} y={102}>{t('diagram.blackjack.draws')}</Note>
      <Note x={210} y={138}>{t('diagram.blackjack.closest')}</Note>
    </svg>
  );
}

function KlondikeDiagram() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 420 190" role="img" aria-label={t('diagram.klondike.label')}>
      <MiniCard x={10} y={10} back />
      <MiniCard x={56} y={10} label="9♣" />
      <Note x={10} y={78} anchor="start">{t('diagram.klondike.stockWaste')}</Note>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={196 + i * 46} y={10} width="38" height="54" rx="5" fill="none" stroke="#f5c542" strokeDasharray="4 3" strokeWidth="1.5" />
          <text x={215 + i * 46} y={43} textAnchor="middle" fontSize="16" fill="#f5c542">A</text>
        </g>
      ))}
      <Note x={196} y={78} anchor="start">{t('diagram.klondike.foundations')}</Note>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i}>
          {Array.from({ length: i + 1 }).map((_, j) => (
            <rect key={j} x={10 + i * 56} y={100 + j * 7} width="38" height="40" rx="4"
              fill={j === i ? '#fff' : '#1e3a8a'} stroke="#0f172a" strokeWidth="1.2" />
          ))}
        </g>
      ))}
      <Note x={210} y={182}>{t('diagram.klondike.tableau')}</Note>
    </svg>
  );
}

function PokerDiagram() {
  const { t } = useI18n();
  const hand = ['A♠', 'A♥', '7♣', '2♦', 'K♠'];
  return (
    <svg viewBox="0 0 420 120" role="img" aria-label={t('diagram.video-poker.label')}>
      {hand.map((c, i) => (
        <g key={c}>
          <MiniCard x={10 + i * 80} y={22} label={c} red={c.includes('♥') || c.includes('♦')} />
          <Note x={29 + i * 80} y={16}>{i < 2 ? t('diagram.video-poker.hold') : ''}</Note>
          <Note x={29 + i * 80} y={96}>{i < 2 ? '' : t('diagram.video-poker.replaced')}</Note>
        </g>
      ))}
      <Note x={210} y={114}>{t('diagram.video-poker.note')}</Note>
    </svg>
  );
}

function HigherLowerDiagram() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 420 130" role="img" aria-label={t('diagram.higher-lower.label')}>
      <MiniCard x={20} y={20} label="7♠" />
      <Note x={39} y={90}>{t('diagram.higher-lower.showing')}</Note>
      <line x1="80" y1="47" x2="150" y2="47" stroke="#f5c542" strokeWidth="2" />
      <polygon points="150,41 162,47 150,53" fill="#f5c542" />
      <MiniCard x={180} y={20} label="?" />
      <Note x={199} y={90}>{t('diagram.higher-lower.next')}</Note>
      <Note x={300} y={32} anchor="start">{t('diagram.higher-lower.higher')}</Note>
      <Note x={300} y={52} anchor="start">{t('diagram.higher-lower.lower')}</Note>
      <Note x={300} y={72} anchor="start">{t('diagram.higher-lower.same', { jackpot: s(JACKPOT_MULTIPLIER) })}</Note>
      <Note x={210} y={120}>{t('diagram.higher-lower.note')}</Note>
    </svg>
  );
}

function RedDogDiagram() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 420 130" role="img" aria-label={t('diagram.red-dog.label')}>
      <MiniCard x={20} y={20} label="4♣" />
      <rect x="82" y="20" width="38" height="54" rx="5" fill="none" stroke="#f5c542" strokeDasharray="4 3" strokeWidth="1.5" />
      <text x="101" y="53" textAnchor="middle" fontSize="18" fill="#f5c542">?</text>
      <MiniCard x={142} y={20} label="9♥" red />
      <Note x={39} y={90}>{t('diagram.red-dog.low')}</Note>
      <Note x={101} y={90}>{t('diagram.red-dog.third')}</Note>
      <Note x={161} y={90}>{t('diagram.red-dog.high')}</Note>
      <Note x={230} y={36} anchor="start">{t('diagram.red-dog.wins')}</Note>
      <Note x={230} y={56} anchor="start">{t('diagram.red-dog.pays')}</Note>
      <Note x={210} y={120}>{t('diagram.red-dog.note')}</Note>
    </svg>
  );
}

function BaccaratDiagram() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 420 150" role="img" aria-label={t('diagram.baccarat.label')}>
      <Note x={10} y={16} anchor="start">{t('diagram.baccarat.player')}</Note>
      <MiniCard x={10} y={24} label="7♠" />
      <MiniCard x={54} y={24} label="8♥" red />
      <Note x={72} y={100}>{t('diagram.baccarat.playerSum')}</Note>
      <Note x={230} y={16} anchor="start">{t('diagram.baccarat.banker')}</Note>
      <MiniCard x={230} y={24} label="4♣" />
      <MiniCard x={274} y={24} label="5♦" red />
      <Note x={292} y={100}>{t('diagram.baccarat.bankerSum')}</Note>
      <Note x={210} y={126}>{t('diagram.baccarat.note1')}</Note>
      <Note x={210} y={144}>{t('diagram.baccarat.note2')}</Note>
    </svg>
  );
}

function SlotsDiagram() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 420 170" role="img" aria-label={t('diagram.slots.label')}>
      <rect x="110" y="8" width="200" height="104" rx="10" fill="#3a2412" stroke="#e5c07b" strokeWidth="3" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={120 + i * 63} y="16" width="56" height="88" rx="6" fill="#fff" />
          <GlaggleAt symbol={(['cherry', 'bell', 'lemon'] as const)[i]} x={136 + i * 63} y={18} size={24} faded />
          <GlaggleAt symbol="seven" x={132 + i * 63} y={45} size={32} />
          <GlaggleAt symbol={(['grape', 'cherry', 'bell'] as const)[i]} x={136 + i * 63} y={80} size={24} faded />
        </g>
      ))}
      <rect x="116" y="55" width="188" height="3" fill="#ef4444" />
      <Note x={210} y={134}>{t('diagram.slots.note1')}</Note>
      <Note x={210} y={156}>{t('diagram.slots.note2')}</Note>
    </svg>
  );
}

function RouletteDiagram() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 420 170" role="img" aria-label={t('diagram.roulette.label')}>
      <MiniCard x={10} y={24} label="17" />
      <Note x={29} y={96}>{t('diagram.roulette.oneNumber')}</Note>
      <Note x={29} y={112}>{t('diagram.roulette.odds35')}</Note>
      <MiniCard x={110} y={24} label="5" red />
      <MiniCard x={150} y={24} label="8" />
      <Note x={149} y={96}>{t('diagram.roulette.twoTouching')}</Note>
      <Note x={149} y={112}>{t('diagram.roulette.odds17')}</Note>
      <MiniCard x={250} y={24} label="1-12" />
      <Note x={269} y={96}>{t('diagram.roulette.dozen')}</Note>
      <Note x={269} y={112}>{t('diagram.roulette.odds2')}</Note>
      <MiniCard x={350} y={24} label={t('diagram.roulette.red')} red />
      <Note x={369} y={96}>{t('diagram.roulette.colour')}</Note>
      <Note x={369} y={112}>{t('diagram.roulette.odds1')}</Note>
      <Note x={210} y={148}>{t('diagram.roulette.note')}</Note>
    </svg>
  );
}

function GinDiagram() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 420 190" role="img" aria-label={t('diagram.gin-rummy.label')}>
      <Note x={62} y={16}>{t('diagram.gin-rummy.set')}</Note>
      <MiniCard x={10} y={24} label="7♥" red />
      <MiniCard x={42} y={24} label="7♠" />
      <MiniCard x={74} y={24} label="7♦" red />
      <Note x={190} y={16}>{t('diagram.gin-rummy.run')}</Note>
      <MiniCard x={140} y={24} label="4♣" />
      <MiniCard x={172} y={24} label="5♣" />
      <MiniCard x={204} y={24} label="6♣" />
      <Note x={330} y={16}>{t('diagram.gin-rummy.deadwood')}</Note>
      <MiniCard x={300} y={24} label="K♠" />
      <MiniCard x={340} y={24} label="3♦" red />
      <Note x={62} y={96}>{t('diagram.gin-rummy.sameNumber')}</Note>
      <Note x={190} y={96}>{t('diagram.gin-rummy.inARow')}</Note>
      <Note x={330} y={96}>{t('diagram.gin-rummy.sum')}</Note>
      <Note x={210} y={128}>{t('diagram.gin-rummy.note1')}</Note>
      <Note x={210} y={148}>{t('diagram.gin-rummy.note2')}</Note>
      <Note x={210} y={168}>{t('diagram.gin-rummy.note3')}</Note>
    </svg>
  );
}

function CrazyEightsDiagram() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 420 170" role="img" aria-label={t('diagram.crazy-eights.label')}>
      <Note x={10} y={16} anchor="start">{t('diagram.crazy-eights.top')}</Note>
      <MiniCard x={10} y={24} label="7♥" red />
      <Note x={150} y={16} anchor="start">{t('diagram.crazy-eights.hand')}</Note>
      <MiniCard x={150} y={24} label="7♠" />
      <MiniCard x={198} y={24} label="K♥" red />
      <MiniCard x={246} y={24} label="8♣" />
      <g opacity="0.45">
        <MiniCard x={294} y={24} label="3♦" red />
      </g>
      <Note x={169} y={96}>{t('diagram.crazy-eights.sameRank')}</Note>
      <Note x={217} y={96}>{t('diagram.crazy-eights.sameSuit')}</Note>
      <Note x={265} y={96}>{t('diagram.crazy-eights.wild')}</Note>
      <Note x={313} y={96}>{t('diagram.crazy-eights.noMatch')}</Note>
      <Note x={210} y={128}>{t('diagram.crazy-eights.note1')}</Note>
      <Note x={210} y={148}>{t('diagram.crazy-eights.note2')}</Note>
      <Note x={210} y={166}>{t('diagram.crazy-eights.note3')}</Note>
    </svg>
  );
}

function HoldemDiagram() {
  const { t } = useI18n();
  return (
    <svg viewBox="0 0 420 160" role="img" aria-label={t('diagram.holdem.label')}>
      <Note x={10} y={16} anchor="start">{t('diagram.holdem.yours')}</Note>
      <MiniCard x={10} y={24} label="A♠" />
      <MiniCard x={54} y={24} label="K♥" red />
      <Note x={130} y={16} anchor="start">{t('diagram.holdem.shared')}</Note>
      <MiniCard x={130} y={24} label="K♦" red />
      <MiniCard x={174} y={24} label="7♣" />
      <MiniCard x={218} y={24} label="2♠" />
      <MiniCard x={262} y={24} label="9♥" red />
      <MiniCard x={306} y={24} label="K♣" />
      <Note x={174} y={96}>{t('street.flop')}</Note>
      <Note x={281} y={96}>{t('street.turn')}</Note>
      <Note x={325} y={96}>{t('street.river')}</Note>
      <Note x={210} y={126}>{t('diagram.holdem.best')}</Note>
      <Note x={210} y={146}>{t('diagram.holdem.result')}</Note>
    </svg>
  );
}

function Section({ title, diagram, children }: { title: string; diagram: ReactNode; children: ReactNode }) {
  return (
    <section className="rules-section">
      <h2>{title}</h2>
      <div className="rules-diagram">{diagram}</div>
      {children}
    </section>
  );
}

interface RulesProps {
  games: NavGame[];
  gameId: string;
  onSelect: (id: string) => void;
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  sort: SortOrder;
  onSortChange: (sort: SortOrder) => void;
}

/** One rules page per game, keyed by the game's id in App.tsx. Add an entry here when you add a game. */
export function Rules({ games, gameId, onSelect, filters, onFiltersChange, sort, onSortChange }: RulesProps) {
  const { t, tb } = useI18n();
  const title = (id: string) => t(`game.${id}.name` as MessageKey);

  const ginValues = {
    hand: s(GIN_HAND_SIZE),
    target: s(MATCH_TARGET),
    knock: s(KNOCK_LIMIT),
    gin: s(GIN_BONUS),
    undercut: s(UNDERCUT_BONUS),
    floor: s(STOCK_FLOOR),
    handBonus: s(HAND_BONUS),
    matchBonus: s(MATCH_BONUS),
    normal: s(GIN_PAYOUT.normal),
    easy: s(GIN_PAYOUT.easy),
    hard: s(GIN_PAYOUT.hard),
    double: s(GIN_BONUS * 2),
  };

  const pages: Record<string, ReactNode> = {
    landlord: (
      <Section title={title('landlord')} diagram={null}>
        <h3>{t('rules.how')}</h3>
        <Items prefix="rules.landlord.how" count={3} />
      </Section>
    ),
    blackjack: (
      <Section title={title('blackjack')} diagram={<BlackjackDiagram />}>
        <h3>{t('rules.how')}</h3>
        <Items prefix="rules.blackjack.how" count={4} />
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.blackjack.tip" count={3} />
      </Section>
    ),

    klondike: (
      <Section title={title('klondike')} diagram={<KlondikeDiagram />}>
        <h3>{t('rules.how')}</h3>
        <Items prefix="rules.klondike.how" count={5} />
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.klondike.tip" count={3} />
      </Section>
    ),

    'video-poker': (
      <Section title={title('video-poker')} diagram={<PokerDiagram />}>
        <h3>{t('rules.how')}</h3>
        <Items prefix="rules.video-poker.how" count={2} />
        <table className="paytable">
          <tbody>
            {PAYTABLE.map((r) => (
              <tr key={r.name}>
                <td>{handText(t, r.name)}</td>
                <td>{r.multiplier}×</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.video-poker.tip" count={4} />
      </Section>
    ),

    'higher-lower': (
      <Section title={title('higher-lower')} diagram={<HigherLowerDiagram />}>
        <h3>{t('rules.how')}</h3>
        <Items prefix="rules.higher-lower.how" count={4} values={{ pot: s(POT_MULTIPLIER), jackpot: s(JACKPOT_MULTIPLIER) }} />
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.higher-lower.tip" count={3} />
      </Section>
    ),

    'red-dog': (
      <Section title={title('red-dog')} diagram={<RedDogDiagram />}>
        <h3>{t('rules.how')}</h3>
        <Items prefix="rules.red-dog.how" count={3} />
        <table className="paytable">
          <tbody>
            {SPREAD_PAYOUTS.map((p) => (
              <tr key={p.spread}>
                <td>{t('rules.red-dog.card', { n: s(p.spread) })}</td>
                <td>{t('rules.red-dog.ratio', { n: s(p.payout) })}</td>
              </tr>
            ))}
            <tr>
              <td>{t('rules.red-dog.wide')}</td>
              <td>{t('rules.red-dog.ratio', { n: s(WIDE_SPREAD_PAYOUT) })}</td>
            </tr>
          </tbody>
        </table>
        <Items prefix="rules.red-dog.after" count={3} values={{ three: s(THREE_OF_A_KIND_PAYOUT) }} />
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.red-dog.tip" count={3} />
      </Section>
    ),

    baccarat: (
      <Section title={title('baccarat')} diagram={<BaccaratDiagram />}>
        <h3>{t('rules.how')}</h3>
        <Items prefix="rules.baccarat.how" count={4} />
        <table className="paytable">
          <tbody>
            <tr>
              <td>{t('rules.baccarat.playerWins')}</td>
              <td>{t('rules.baccarat.ratio', { n: s(PLAYER_PAYOUT) })}</td>
            </tr>
            <tr>
              <td>{t('rules.baccarat.bankerWins')}</td>
              <td>{t('rules.baccarat.ratio', { n: `0.${BANKER_PAYOUT_PERCENT}` })}</td>
            </tr>
            <tr>
              <td>{t('rules.baccarat.tie')}</td>
              <td>{t('rules.baccarat.ratio', { n: s(TIE_PAYOUT) })}</td>
            </tr>
          </tbody>
        </table>
        <Items prefix="rules.baccarat.after" count={2} />
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.baccarat.tip" count={3} />
      </Section>
    ),
    'crazy-eights': (
      <Section title={title('crazy-eights')} diagram={<CrazyEightsDiagram />}>
        <h3>{t('rules.how')}</h3>
        <Items prefix="rules.crazy-eights.how" count={6} values={{ hand: s(HAND_SIZE), win: s(WIN_PAYOUT) }} />
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.crazy-eights.tip" count={4} />
      </Section>
    ),
    slots: (
      <Section title={title('slots')} diagram={<SlotsDiagram />}>
        <h3>{t('rules.how')}</h3>
        <ul>
          <li>{tb('rules.slots.how.1')}</li>
          <li>{tb('rules.slots.how.2')}</li>
          <li>
            {tb('rules.slots.how.3')}
            <ul>
              {(['seven', 'diamond', 'bell', 'grape', 'lemon', 'cherry'] as const).map((symbol) => (
                <li key={symbol}>
                  <GlaggleRow symbol={symbol} count={3} />
                  {tb('rules.slots.three', { n: s(THREE_OF_A_KIND[symbol]) })}
                </li>
              ))}
              <li>
                <GlaggleRow symbol="cherry" count={2} />
                {tb('rules.slots.cherries', { n: s(TWO_CHERRIES) })}
              </li>
            </ul>
          </li>
          <li>{tb('rules.slots.how.4')}</li>
        </ul>
        <h3>{t('rules.odds')}</h3>
        <Items prefix="rules.slots.odds" count={3} values={{ back: s(Math.round(RETURN_TO_PLAYER * 100)), hit: s(Math.round(1 / HIT_RATE)) }} />
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.slots.tip" count={2} />
      </Section>
    ),
    roulette: (
      <Section title={title('roulette')} diagram={<RouletteDiagram />}>
        <h3>{t('rules.how')}</h3>
        <ul>
          <li>{tb('rules.roulette.how.1')}</li>
          <li>{tb('rules.roulette.how.2', { chips: CHIPS.join(', ') })}</li>
          <li>{tb('rules.roulette.how.3')}</li>
          <li>
            {tb('rules.roulette.how.4')}
            <ul>
              <li>{tb('rules.roulette.straight', { n: s(payoutOdds(straightSpot(1).numbers)) })}</li>
              <li>{tb('rules.roulette.split', { n: s(payoutOdds(splitSpot(1, 2)!.numbers)) })}</li>
              <li>{tb('rules.roulette.street', { n: s(payoutOdds(streetSpot(0).numbers)) })}</li>
              <li>{tb('rules.roulette.corner', { n: s(payoutOdds(cornerSpot(0, 0).numbers)) })}</li>
              <li>{tb('rules.roulette.sixLine', { n: s(payoutOdds(sixLineSpot(0).numbers)) })}</li>
              <li>{tb('rules.roulette.column', { n: s(payoutOdds(columnSpot(0).numbers)) })}</li>
              <li>{tb('rules.roulette.evenMoney', { n: s(payoutOdds(evenMoneySpot('red').numbers)) })}</li>
            </ul>
          </li>
          <li>{tb('rules.roulette.how.5')}</li>
        </ul>
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.roulette.tip" count={3} />
      </Section>
    ),
    'gin-rummy': (
      <Section title={title('gin-rummy')} diagram={<GinDiagram />}>
        <h3>{t('rules.how')}</h3>
        <ul>
          {keys('rules.gin-rummy.how', 12).map((key) => (
            <li key={key}>{tb(key, ginValues)}</li>
          ))}
          <li>
            {tb('rules.gin-rummy.how.13')}
            <ul>
              {keys('rules.gin-rummy.setting', 4).map((key) => (
                <li key={key}>{tb(key, ginValues)}</li>
              ))}
            </ul>
          </li>
        </ul>
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.gin-rummy.tip" count={4} />
      </Section>
    ),
    holdem: (
      <Section title={title('holdem')} diagram={<HoldemDiagram />}>
        <h3>{t('rules.how')}</h3>
        <ul>
          <li>{tb('rules.holdem.how.1', { buyIn: s(BUY_IN) })}</li>
          <li>{tb('rules.holdem.how.2')}</li>
          <li>{tb('rules.holdem.how.3', { small: s(SMALL_BLIND), big: s(BIG_BLIND) })}</li>
          <li>
            {tb('rules.holdem.how.4')}
            <ul>
              {(['fold', 'check', 'call', 'raise', 'allIn'] as const).map((action) => (
                <li key={action}>{tb(`rules.holdem.action.${action}` as MessageKey)}</li>
              ))}
            </ul>
          </li>
          <li>{tb('rules.holdem.how.5', { early: s(betSize('preflop')), late: s(betSize('turn')), raises: s(MAX_RAISES) })}</li>
          <li>{tb('rules.holdem.how.6')}</li>
          <li>{tb('rules.holdem.how.7')}</li>
          <li>{tb('rules.holdem.how.8')}</li>
          <li>{tb('rules.holdem.how.9')}</li>
        </ul>
        <h3>{t('rules.bestHands')}</h3>
        <table className="paytable">
          <tbody>
            {(
              [
                ['Royal Flush', 'royal'],
                [CATEGORY_NAMES[8], 'straightFlush'],
                [CATEGORY_NAMES[7], 'four'],
                [CATEGORY_NAMES[6], 'fullHouse'],
                [CATEGORY_NAMES[5], 'flush'],
                [CATEGORY_NAMES[4], 'straight'],
                [CATEGORY_NAMES[3], 'three'],
                [CATEGORY_NAMES[2], 'twoPair'],
                [CATEGORY_NAMES[1], 'pair'],
                [CATEGORY_NAMES[0], 'high'],
              ] as const
            ).map(([name, what]) => (
              <tr key={name}>
                <td>{handText(t, name)}</td>
                <td>{t(`rules.holdem.hand.${what}` as MessageKey)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>{t('rules.tips')}</h3>
        <Items prefix="rules.holdem.tip" count={7} />
      </Section>
    ),
  };

  return (
    <div className="rules">
      <GameNav
        games={games}
        activeId={gameId}
        onSelect={onSelect}
        filters={filters}
        onFiltersChange={onFiltersChange}
        sort={sort}
        onSortChange={onSortChange}
      />
      {pages[gameId] ?? <p className="blurb">{t('rules.missing')}</p>}
    </div>
  );
}
